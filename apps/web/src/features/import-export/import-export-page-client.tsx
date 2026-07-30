'use client';

import { ImportExportClient } from '@/components/import-export-client';
import { PageHeader } from '@/components/page-header';

export function ImportExportPageClient(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Importar / Exportar"
        description="CSV e XLSX com template oficial, mapeamento automático e preview antes de gravar."
      />
      <ImportExportClient />
    </div>
  );
}
