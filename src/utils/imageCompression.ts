// Compressão de imagem no cliente (canvas) — pra ninguém precisar comprimir foto
// à mão antes de subir avatar. Redimensiona pra um lado máximo e re-encoda em
// JPEG, reduzindo a qualidade até caber no limite de bytes.

interface CompressOptions {
  /** Maior lado da imagem em px (padrão 1024 — suficiente pra avatar). */
  maxDim?: number;
  /** Tamanho-alvo máximo em bytes (padrão 5MB). */
  maxBytes?: number;
  /** Qualidade JPEG inicial (0–1). */
  quality?: number;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao ler a imagem'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * Comprime/redimensiona uma imagem no navegador. Retorna um novo File (JPEG) ou
 * o arquivo original quando não vale a pena mexer (ex.: SVG/GIF, ou já pequeno).
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxDim = opts.maxDim ?? 1024;
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  let quality = opts.quality ?? 0.85;

  // Não mexe em não-imagens, SVG (vetorial) ou GIF (perderia animação).
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  try {
    const img = await loadImage(await readAsDataURL(file));
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Fundo branco pra transparências não virarem preto ao converter pra JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    while (blob && blob.size > maxBytes && quality > 0.4) {
      quality -= 0.15;
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    }
    if (!blob) return file;

    // Se não reduziu e o original já cabe, mantém o original.
    if (blob.size >= file.size && file.size <= maxBytes) return file;

    const baseName = file.name.replace(/\.[^./\\]+$/, '') || 'avatar';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    // Qualquer falha na compressão → devolve o original (o upload decide o que fazer).
    return file;
  }
}
