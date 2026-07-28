import { Directory, File, Paths } from 'expo-file-system';

/**
 * Captures live in the app's document directory, not the cache, because a
 * queued photo has to survive the phone deciding it needs space. The file is
 * the record until JobTread confirms the upload.
 */

const DIR = 'captures';

function captureDir(): Directory {
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Move a freshly-shot file out of the camera's temp location. */
export async function keepCapture(sourceUri: string, id: string, kind: 'photo' | 'video'): Promise<string> {
  const src = new File(sourceUri);
  const ext = src.extension || (kind === 'video' ? '.mov' : '.jpg');
  const dest = new File(captureDir(), `${id}${ext}`);
  try {
    await src.move(dest);
    return dest.uri;
  } catch {
    // If the move fails (different volume, sandbox quirk) keep the original —
    // a capture we can still see beats a capture we lost.
    return sourceUri;
  }
}

export async function deleteCapture(uri: string | null): Promise<void> {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // nothing to do — the file is already gone
  }
}
