/**
 * Tiny client-side JPEG for Phase 16 "simulated capture".
 * Real camera / file picker can replace this later without changing PhotoService.
 */
export async function createSimulatedPhotoBlob(label: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new Blob([`RushBuddy photo placeholder: ${label}`], { type: 'image/jpeg' });
  }
  ctx.fillStyle = '#0B1120';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#22D3EE';
  ctx.font = '24px sans-serif';
  ctx.fillText('RushBuddy evidence', 24, 48);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px monospace';
  ctx.fillText(label, 24, 88);
  ctx.fillText(new Date().toISOString(), 24, 120);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('photo blob failed'))),
      'image/jpeg',
      0.85,
    );
  });
}
