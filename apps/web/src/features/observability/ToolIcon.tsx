const ICON_PATHS: Record<string, string> = {
  bash: "M4 17l6-6-6-6M12 19h8",
  read: "M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h6",
  write: "M6 2h9l5 5v15H6zM15 2v5h5M12 11v6M9 14h6",
  edit: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
  grep: "M11 11a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM21 21l-4.35-4.35",
  glob: "M3 7l3-4h12l3 4M3 7v13h18V7M3 7h18M8 7v13M16 7v13",
  webfetch: "M12 2a15 15 0 0 0 0 20M12 2a15 15 0 0 1 0 20M2 12h20M3.5 7h17M3.5 17h17",
  websearch: "M11 11a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-9a3 3 0 0 1 3 3M21 21l-4.35-4.35"
};

export function ToolIcon({ name }: { name: string }) {
  const d = ICON_PATHS[name];
  if (!d) {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
