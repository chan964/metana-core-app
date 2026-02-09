import { Artefact } from '@/types';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, Download, Trash2 } from 'lucide-react';

interface ArtefactListProps {
  artefacts: Artefact[];
  canManage?: boolean;
  onDelete?: (id: string) => void;
}

export function ArtefactList({ artefacts, canManage = false, onDelete }: ArtefactListProps) {
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('text')) return '📝';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('video')) return '🎥';
    return '📎';
  };

  const isExternalLink = (url: string) => {
    return url.startsWith('http://') || url.startsWith('https://');
  };

  if (artefacts.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No artefacts available.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {artefacts.map((artefact) => (
        <div
          key={artefact.id}
          className="flex items-center justify-between rounded-md border bg-card p-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{getFileIcon(artefact.fileType)}</span>
            <div>
              <div className="font-medium">{artefact.filename}</div>
              <div className="text-xs text-muted-foreground">{artefact.fileType}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={`/api/artefacts/${artefact.id}/download`} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
            {canManage && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => onDelete(artefact.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
