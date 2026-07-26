'use client';

export function centerFilterOptions(
  centers: Array<{ id: string; name: string }>,
): Array<{ value: string; label: string }> {
  return [
    { value: 'all', label: 'Todos' },
    ...centers.map((center) => ({ value: center.id, label: center.name })),
  ];
}
