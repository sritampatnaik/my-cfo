export function filenameParts(filename: string) {
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot) : "";
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const base = stem.replace(/\s+\(\d+\)$/, "");
  const firstPart = base.split(/[\s._-]+/).find((part) => part.length > 0) ?? base;
  return { base, ext, firstPart };
}

export function noteDuplicate(filename: string, previousNames: string[]) {
  const current = filenameParts(filename);
  const matches = previousNames.filter((name) => {
    const other = filenameParts(name);
    return other.firstPart.toLowerCase() === current.firstPart.toLowerCase();
  });
  if (matches.length === 0) {
    return { notedName: filename, warning: null as string | null };
  }
  return {
    notedName: `${current.base} (${matches.length})${current.ext}`,
    warning: `Looks like ${matches[0]}`,
  };
}
