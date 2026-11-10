import { useEffect, type ReactNode } from 'react';
import { useBlobUrl } from '../lib/image';

const ICONS: Record<string, ReactNode> = {
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  box: <path d="M3 8l9-5 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8" />,
  note: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" />,
  camera: (<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>),
  pencil: <path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  trash: <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />,
  share: <path d="M12 15V4M8 8l4-4 4 4M5 12v8h14v-8" />,
  settings: (<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>),
  play: <path d="M8 5l11 7-11 7z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  undo: <path d="M8 6L3 11l5 5M3 11h11a5 5 0 0 1 0 10h-3" />,
  redo: <path d="M16 6l5 5-5 5M21 11H10a5 5 0 0 0 0 10h3" />,
  pin: (<><path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>),
  line: <path d="M5 19L19 5" />,
  rect: <rect x="4" y="6" width="16" height="12" />,
  text: <path d="M5 6h14M12 6v13M9 19h6" />,
  eraser: <path d="M4 16l9-9 6 6-6 6H8l-4-3zM10 10l6 6M13 19h7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function Header({ title, subtitle, back, actions }: { title: string; subtitle?: string; back?: string; actions?: ReactNode }) {
  return (
    <header className="header no-print">
      {back !== undefined && (
        <a className="hbtn back" href={'#' + back} aria-label="Zurück">
          <Icon name="back" />
        </a>
      )}
      <div className="htitle">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="hactions">{actions}</div>
    </header>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose}>
            Abbrechen
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Fab({ label, onClick, icon = 'plus' }: { label: string; onClick: () => void; icon?: string }) {
  return (
    <button type="button" className="fab no-print" onClick={onClick} aria-label={label}>
      <Icon name={icon} size={26} />
    </button>
  );
}

export function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function BufferImg({ data, mime, alt, className }: { data: ArrayBuffer | null | undefined; mime?: string; alt: string; className?: string }) {
  const url = useBlobUrl(data, mime);
  return url ? <img src={url} alt={alt} className={className} /> : <div className={`img-placeholder ${className ?? ''}`} />;
}

/** Buttons am Ende eines Formulars: Speichern + optional Löschen (mit Rückfrage). */
export function FormActions({ onDelete, saveLabel = 'Speichern', disabled }: { onDelete?: () => void; saveLabel?: string; disabled?: boolean }) {
  return (
    <div className="form-actions">
      {onDelete && (
        <button type="button" className="btn danger" onClick={() => window.confirm('Eintrag wirklich löschen?') && onDelete()}>
          Löschen
        </button>
      )}
      <button type="submit" className="btn primary" disabled={disabled}>
        {saveLabel}
      </button>
    </div>
  );
}
