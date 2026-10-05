import { prisma } from '../db/prisma';
import { aiClient } from './aiClient';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';

const MIN_ENROLLMENT_SAMPLES = 3;
const MIN_SAMPLE_QUALITY = 0.35;

/**
 * Enrolls a student's face using multiple captured frames. Each frame is
 * independently validated (exactly one face, adequate quality) before its
 * embedding is generated and stored. Raw images are never persisted - only
 * the resulting numeric embeddings are written to the database.
 */
export async function enrollFace(studentId: string, images: string[]) {
  if (images.length < MIN_ENROLLMENT_SAMPLES) {
    throw new ValidationError(
      `At least ${MIN_ENROLLMENT_SAMPLES} face samples are required for reliable enrollment`,
    );
  }

  const profile = await prisma.faceProfile.upsert({
    where: { studentId },
    update: {},
    create: { studentId, status: 'NOT_ENROLLED' },
  });

  if (profile.status === 'ENROLLED') {
    throw new AppError(
      'FACE_ALREADY_ENROLLED',
      'A face profile already exists. Ask an administrator to reset it before re-enrolling.',
      409,
    );
  }

  const embeddings: { vector: number[]; quality: number }[] = [];

  for (const image of images) {
    const detection = await aiClient.detectFace(image);
    if (detection.faceCount === 0) {
      throw new ValidationError(
        'No face detected in one of the captured samples. Please retake clearly lit photos.',
      );
    }
    if (detection.faceCount > 1) {
      throw new ValidationError(
        'Only one person should be visible in the camera during enrollment.',
      );
    }
    if (detection.quality === 'too_dark' || detection.quality === 'too_bright') {
      throw new ValidationError(
        'Lighting conditions are inadequate for one of the samples. Please retake in better lighting.',
      );
    }

    const extraction = await aiClient.extractEmbedding(image);
    if (extraction.quality < MIN_SAMPLE_QUALITY) {
      throw new ValidationError(
        'Face sample quality is too low. Please retake with the face centered and well lit.',
      );
    }
    embeddings.push({ vector: extraction.embedding, quality: extraction.quality });
  }

  await prisma.$transaction(async (tx) => {
    await tx.faceEmbedding.deleteMany({ where: { faceProfileId: profile.id } });
    for (const e of embeddings) {
      await tx.faceEmbedding.create({
        data: { faceProfileId: profile.id, vector: e.vector, quality: e.quality },
      });
    }
    await tx.faceProfile.update({
      where: { id: profile.id },
      data: { status: 'ENROLLED', sampleCount: embeddings.length, enrolledAt: new Date() },
    });
  });

  return { status: 'ENROLLED', sampleCount: embeddings.length };
}

export async function getFaceProfileStatus(studentId: string) {
  const profile = await prisma.faceProfile.findUnique({ where: { studentId } });
  return {
    status: profile?.status ?? 'NOT_ENROLLED',
    sampleCount: profile?.sampleCount ?? 0,
    enrolledAt: profile?.enrolledAt ?? null,
  };
}

/** Admin-only: clears a student's existing embeddings so they can re-enroll. */
export async function resetFaceProfile(studentId: string, adminUserId: string) {
  const profile = await prisma.faceProfile.findUnique({ where: { studentId } });
  if (!profile) throw new NotFoundError('Face profile not found');

  await prisma.$transaction([
    prisma.faceEmbedding.deleteMany({ where: { faceProfileId: profile.id } }),
    prisma.faceProfile.update({
      where: { id: profile.id },
      data: {
        status: 'RESET',
        sampleCount: 0,
        resetAt: new Date(),
        resetBy: adminUserId,
        enrolledAt: null,
      },
    }),
  ]);

  return { status: 'RESET' };
}

export async function getReferenceEmbeddings(studentId: string): Promise<number[][]> {
  const profile = await prisma.faceProfile.findUnique({
    where: { studentId },
    include: { embeddings: true },
  });
  if (!profile || profile.status !== 'ENROLLED' || profile.embeddings.length === 0) {
    throw new AppError(
      'FACE_NOT_ENROLLED',
      'Face has not been enrolled yet. Please complete face enrollment before marking attendance.',
      400,
    );
  }
  return profile.embeddings.map((e) => e.vector);
}
