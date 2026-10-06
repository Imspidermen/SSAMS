import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crosshair, MapPin, Pencil, Plus, RotateCcw } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { useToast } from '@/hooks/useToast';
import {
  useClassrooms,
  useCreateClassroom,
  useUpdateClassroom,
} from '@/hooks/queries/useAdminQueries';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  classroomSchema,
  toClassroomPayload,
  type ClassroomFormValues,
} from '@/validators/academic.schema';
import { describeApiError } from '@/utils/apiError';
import { formatDistance, formatNumber } from '@/utils/format';
import { useMemo } from 'react';
import type { Classroom } from '@/types';

/**
 * Classroom management. A classroom carries the geofence centre and radius that
 * the attendance pipeline enforces, so accurate coordinates matter.
 *
 * Backed by GET/POST /admin/classrooms and PATCH /admin/classrooms/:id.
 */
export function ClassroomsPage() {
  const toast = useToast();
  const classrooms = useClassrooms();
  const createClassroom = useCreateClassroom();
  const updateClassroom = useUpdateClassroom();
  const geolocation = useGeolocation();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ClassroomFormValues>({
    resolver: zodResolver(classroomSchema),
    defaultValues: {
      name: '',
      building: '',
      floor: '',
      latitude: 0,
      longitude: 0,
      radiusMeters: 100,
    },
    mode: 'onBlur',
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', building: '', floor: '', latitude: 0, longitude: 0, radiusMeters: 100 });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (classroom: Classroom) => {
    setEditing(classroom);
    reset({
      name: classroom.name,
      building: classroom.building ?? '',
      floor: classroom.floor ?? '',
      latitude: classroom.latitude,
      longitude: classroom.longitude,
      radiusMeters: classroom.radiusMeters,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const captureCurrentLocation = async () => {
    const position = await geolocation.locate();
    if (!position) {
      if (geolocation.error) setFormError(geolocation.error);
      return;
    }
    setValue('latitude', Number(position.latitude.toFixed(6)), { shouldValidate: true });
    setValue('longitude', Number(position.longitude.toFixed(6)), { shouldValidate: true });
    toast.info(
      'Location captured',
      `Coordinates set with ±${formatDistance(position.accuracyMeters)} accuracy. Verify them before saving.`,
    );
  };

  const filtered = useMemo(() => {
    const items = classrooms.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (room) =>
        room.name.toLowerCase().includes(term) ||
        (room.building ?? '').toLowerCase().includes(term) ||
        (room.floor ?? '').toLowerCase().includes(term),
    );
  }, [classrooms.data, search]);

  const columns: DataTableColumn<Classroom>[] = [
    {
      id: 'name',
      header: 'Classroom',
      cell: (room) => (
        <div>
          <div className="cell-primary">{room.name}</div>
          <div className="cell-sub">
            {[room.building, room.floor].filter(Boolean).join(' · ') || 'No building set'}
          </div>
        </div>
      ),
    },
    {
      id: 'coordinates',
      header: 'Geofence centre',
      cell: (room) => (
        <span className="text-mono">
          {room.latitude.toFixed(5)}, {room.longitude.toFixed(5)}
        </span>
      ),
      hideOn: 'tablet',
    },
    {
      id: 'radius',
      header: 'Radius',
      align: 'right',
      cell: (room) => <Badge tone="info">{formatDistance(room.radiusMeters)}</Badge>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'cell-actions',
      cell: (room) => (
        <div className="row-actions">
          <IconButton
            size="sm"
            variant="bordered"
            icon={<Pencil size={15} />}
            label={`Edit ${room.name}`}
            onClick={() => openEdit(room)}
          />
        </div>
      ),
    },
  ];

  const onSubmit = async (values: ClassroomFormValues) => {
    setFormError(null);
    const payload = toClassroomPayload(values);
    try {
      if (editing) {
        await updateClassroom.mutateAsync({ id: editing.id, payload });
        toast.success('Classroom updated', `${payload.name} was saved.`);
      } else {
        await createClassroom.mutateAsync(payload);
        toast.success('Classroom created', `${payload.name} can now be used in sessions.`);
      }
      setFormOpen(false);
    } catch (error) {
      setFormError(describeApiError(error));
    }
  };

  const isSubmitting = createClassroom.isPending || updateClassroom.isPending;

  return (
    <>
      <PageHeader
        title="Classrooms"
        subtitle="Each classroom defines the geofence centre and radius used to verify that a student is physically present."
        actions={
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            Add classroom
          </Button>
        }
      />

      <Card flush>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(room) => room.id}
          isLoading={classrooms.isPending}
          isFetching={classrooms.isFetching}
          error={classrooms.isError ? classrooms.error : null}
          onRetry={() => void classrooms.refetch()}
          caption="Classrooms"
          emptyVariant={search ? 'search' : 'default'}
          emptyTitle={search ? 'No classrooms match your search' : 'No classrooms configured'}
          emptyMessage={
            search
              ? 'Try a different room, building or floor.'
              : 'Add a room with its real coordinates so attendance sessions can enforce the geofence.'
          }
          emptyActionLabel={search ? undefined : 'Add classroom'}
          onEmptyAction={search ? undefined : openCreate}
          toolbar={
            <div className="toolbar">
              <SearchInput
                className="toolbar__group"
                label="Search classrooms"
                placeholder="Search by room, building or floor…"
                value={search}
                onChange={setSearch}
              />
              <div className="toolbar__actions">
                <span className="text-caption">
                  {formatNumber(classrooms.data?.length ?? 0)} rooms
                </span>
                <IconButton
                  variant="bordered"
                  icon={<RotateCcw size={16} />}
                  label="Refresh classrooms"
                  onClick={() => void classrooms.refetch()}
                  disabled={classrooms.isFetching}
                />
              </div>
            </div>
          }
          renderMobileCard={(room) => (
            <>
              <div className="card-list__header">
                <div>
                  <p className="card-list__title">{room.name}</p>
                  <p className="text-caption">
                    {[room.building, room.floor].filter(Boolean).join(' · ') || 'No building set'}
                  </p>
                </div>
                <Badge tone="info">{formatDistance(room.radiusMeters)}</Badge>
              </div>
              <p
                className="text-caption text-mono"
                style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}
              >
                <MapPin size={13} aria-hidden="true" />
                {room.latitude.toFixed(5)}, {room.longitude.toFixed(5)}
              </p>
              <div className="card-list__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Pencil size={14} />}
                  onClick={() => openEdit(room)}
                >
                  Edit
                </Button>
              </div>
            </>
          )}
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !isSubmitting && setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add classroom'}
        description="Set the real-world centre of the room. Students outside the radius cannot mark attendance."
        size="md"
        dismissible={!isSubmitting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="classroom-form"
              isLoading={isSubmitting}
              loadingText="Saving…"
            >
              {editing ? 'Save changes' : 'Create classroom'}
            </Button>
          </>
        }
      >
        <form
          id="classroom-form"
          className="stack stack-4"
          noValidate
          onSubmit={handleSubmit((values) => void onSubmit(values))}
        >
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="form-grid">
            <div className="form-grid__full">
              <Field label="Room name" htmlFor="room-name" error={errors.name?.message} required>
                <Input
                  id="room-name"
                  placeholder="Room 204"
                  invalid={Boolean(errors.name)}
                  {...register('name')}
                />
              </Field>
            </div>

            <Field label="Building" htmlFor="room-building" error={errors.building?.message}>
              <Input
                id="room-building"
                placeholder="Main Block"
                invalid={Boolean(errors.building)}
                {...register('building')}
              />
            </Field>

            <Field label="Floor" htmlFor="room-floor" error={errors.floor?.message}>
              <Input
                id="room-floor"
                placeholder="2nd Floor"
                invalid={Boolean(errors.floor)}
                {...register('floor')}
              />
            </Field>

            <Field
              label="Latitude"
              htmlFor="room-latitude"
              error={errors.latitude?.message}
              required
              hint="Between -90 and 90."
            >
              <Input
                id="room-latitude"
                type="number"
                step="0.000001"
                inputMode="decimal"
                invalid={Boolean(errors.latitude)}
                {...register('latitude')}
              />
            </Field>

            <Field
              label="Longitude"
              htmlFor="room-longitude"
              error={errors.longitude?.message}
              required
              hint="Between -180 and 180."
            >
              <Input
                id="room-longitude"
                type="number"
                step="0.000001"
                inputMode="decimal"
                invalid={Boolean(errors.longitude)}
                {...register('longitude')}
              />
            </Field>

            <div className="form-grid__full">
              <Field
                label="Geofence radius (metres)"
                htmlFor="room-radius"
                error={errors.radiusMeters?.message}
                required
                hint="Students must be within this distance of the centre. 5–2000 m."
              >
                <Input
                  id="room-radius"
                  type="number"
                  min={5}
                  max={2000}
                  step={5}
                  inputMode="numeric"
                  invalid={Boolean(errors.radiusMeters)}
                  {...register('radiusMeters')}
                />
              </Field>
            </div>
          </div>

          <div className="row">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Crosshair size={15} />}
              onClick={() => void captureCurrentLocation()}
              isLoading={geolocation.status === 'locating'}
              loadingText="Locating…"
            >
              Use my current location
            </Button>
            {geolocation.location ? (
              <span className="text-caption">
                Accuracy ±{formatDistance(geolocation.location.accuracyMeters)}
              </span>
            ) : null}
          </div>

          {geolocation.error ? <Alert tone="warning">{geolocation.error}</Alert> : null}
        </form>
      </Modal>
    </>
  );
}
