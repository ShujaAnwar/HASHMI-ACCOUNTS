import { jsPDF } from 'jspdf';

export interface GenerateA4PdfOptions {
  desktopWidthPx?: number;
  marginMm?: number;
  preserveMinHeight?: boolean;
  scale?: number;
  imageQuality?: number;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const DEFAULT_A4_WIDTH_PX = 794; // 210mm at 96 DPI (210 * 96 / 25.4)
const DEFAULT_A4_MIN_HEIGHT_PX = 1112; // ~294.2mm so single-page vouchers don't spill onto a blank page 2

const waitForImages = async (root: HTMLElement): Promise<void> => {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2500);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    })
  );
};

const preparePdfClone = (
  source: HTMLElement,
  captureWidth: number,
  preserveMinHeight: boolean
): HTMLElement => {
  const clone = source.cloneNode(true) as HTMLElement;

  // Normalize root box so mobile viewport / scroll / fixed heights never clip or shift it
  clone.style.width = `${captureWidth}px`;
  clone.style.minWidth = `${captureWidth}px`;
  clone.style.maxWidth = `${captureWidth}px`;
  clone.style.height = 'auto';
  clone.style.minHeight = preserveMinHeight ? `${DEFAULT_A4_MIN_HEIGHT_PX}px` : 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.margin = '0';
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.backgroundColor = '#ffffff';
  clone.style.boxSizing = 'border-box';

  // Remove responsive horizontal scroll clipping on tables so no columns are cut off on mobile
  const scrollContainers = clone.querySelectorAll('.overflow-x-auto, .overflow-y-auto');
  scrollContainers.forEach((node) => {
    const el = node as HTMLElement;
    el.style.overflow = 'visible';
    el.style.overflowX = 'visible';
    el.style.overflowY = 'visible';
    el.style.maxWidth = 'none';
    el.style.width = '100%';
  });

  // Remove vertical clipping on flex-1 content containers inside All-In-One / Package vouchers
  const clippedContentWrappers = clone.querySelectorAll('.flex-1.overflow-hidden');
  clippedContentWrappers.forEach((node) => {
    const el = node as HTMLElement;
    el.style.overflow = 'visible';
    el.style.maxHeight = 'none';
  });

  // Hide any interactive-only elements
  const noPrintEls = clone.querySelectorAll('.no-print');
  noPrintEls.forEach((node) => {
    (node as HTMLElement).style.display = 'none';
  });

  return clone;
};

/**
 * Generates an exact A4 portrait PDF from a DOM element reliably on both mobile and desktop.
 * - Isolates the clone at desktop A4 width (794px) with scrollX=0, scrollY=0, x=0, y=0
 * - Prevents mobile viewport clipping, extra white margins, and dark-mode color leakage
 * - Keeps 1-page vouchers on 1 page without blank page 2, and paginates multi-page vouchers cleanly
 */
export const generateA4PdfFromElement = async (
  sourceElement: HTMLElement,
  fileName: string,
  options: GenerateA4PdfOptions = {}
): Promise<{ doc: jsPDF; blob: Blob; fileName: string }> => {
  const {
    desktopWidthPx = DEFAULT_A4_WIDTH_PX,
    marginMm = 0,
    preserveMinHeight = true,
    scale = 2,
    imageQuality = 0.96
  } = options;

  // @ts-ignore - html2pdf is loaded globally in index.html
  const html2pdfFn = (window as any).html2pdf;
  if (!html2pdfFn) {
    throw new Error('PDF generator library is not loaded yet.');
  }

  // Wait for fonts & source images before cloning
  try {
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }
  } catch {
    // Ignore font readiness errors on older WebViews
  }
  await waitForImages(sourceElement);

  const clone = preparePdfClone(sourceElement, desktopWidthPx, preserveMinHeight);

  // Measure full natural height at exact desktop A4 width off-screen
  const measurer = document.createElement('div');
  measurer.style.position = 'fixed';
  measurer.style.left = '-10000px';
  measurer.style.top = '0';
  measurer.style.width = `${desktopWidthPx}px`;
  measurer.style.height = 'auto';
  measurer.style.margin = '0';
  measurer.style.padding = '0';
  measurer.style.opacity = '0';
  measurer.style.pointerEvents = 'none';
  measurer.style.background = '#ffffff';
  measurer.appendChild(clone);
  document.body.appendChild(measurer);

  let fullHeight = DEFAULT_A4_MIN_HEIGHT_PX;
  try {
    await waitForImages(clone);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const measuredRect = clone.getBoundingClientRect();
    fullHeight = Math.max(
      Math.ceil(clone.scrollHeight),
      Math.ceil(measuredRect.height),
      preserveMinHeight ? DEFAULT_A4_MIN_HEIGHT_PX : 300
    );
  } finally {
    if (measurer.parentNode) {
      measurer.parentNode.removeChild(measurer);
    }
  }

  const html2canvasOpts = {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    width: desktopWidthPx,
    height: fullHeight,
    windowWidth: Math.max(desktopWidthPx, 1024),
    windowHeight: Math.max(fullHeight, 1200),
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
    logging: false,
    onclone: (clonedDoc: Document) => {
      clonedDoc.documentElement.classList.remove('dark');
      clonedDoc.documentElement.style.margin = '0';
      clonedDoc.documentElement.style.padding = '0';
      clonedDoc.body.style.margin = '0';
      clonedDoc.body.style.padding = '0';
      clonedDoc.body.style.background = '#ffffff';
      clonedDoc.body.style.overflow = 'visible';

      // Ensure html2pdf's internal overlay/container sits cleanly at (0, 0) at full desktop width
      const overlay = clonedDoc.querySelector('.html2pdf__overlay') as HTMLElement | null;
      if (overlay) {
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.right = 'auto';
        overlay.style.bottom = 'auto';
        overlay.style.width = `${desktopWidthPx}px`;
        overlay.style.height = `${fullHeight}px`;
        overlay.style.overflow = 'visible';
        overlay.style.opacity = '1';
        overlay.style.backgroundColor = '#ffffff';
      }

      const container = clonedDoc.querySelector('.html2pdf__container') as HTMLElement | null;
      if (container) {
        container.style.position = 'relative';
        container.style.left = '0';
        container.style.top = '0';
        container.style.width = `${desktopWidthPx}px`;
        container.style.height = `${fullHeight}px`;
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.overflow = 'visible';
        container.style.backgroundColor = '#ffffff';
      }
    }
  };

  const canvas: HTMLCanvasElement = await html2pdfFn()
    .set({
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: imageQuality },
      html2canvas: html2canvasOpts,
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .from(clone)
    .toCanvas()
    .get('canvas');

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error('Captured PDF canvas is empty.');
  }

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true
  });

  const usableWidthMm = A4_WIDTH_MM - marginMm * 2;
  const usableHeightMm = A4_HEIGHT_MM - marginMm * 2;
  const contentHeightMm = (canvas.height / canvas.width) * usableWidthMm;

  if (contentHeightMm <= usableHeightMm) {
    // Fits cleanly on a single A4 page with zero extra margins
    const imgData = canvas.toDataURL('image/jpeg', imageQuality);
    doc.addImage(imgData, 'JPEG', marginMm, marginMm, usableWidthMm, contentHeightMm, undefined, 'FAST');
  } else if (contentHeightMm <= usableHeightMm + 16) {
    // Slightly taller due to mobile font wrapping: fit cleanly on 1 A4 page instead of creating a tiny trailing 2nd page
    const fitRatio = usableHeightMm / contentHeightMm;
    const drawWidth = usableWidthMm * fitRatio;
    const drawX = marginMm + (usableWidthMm - drawWidth) / 2;
    const imgData = canvas.toDataURL('image/jpeg', imageQuality);
    doc.addImage(imgData, 'JPEG', drawX, marginMm, drawWidth, usableHeightMm, undefined, 'FAST');
  } else {
    // Multi-page document: slice canvas accurately page by page so zero rows are clipped
    const pxPerPage = Math.floor((usableHeightMm / usableWidthMm) * canvas.width);
    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      const sliceHeight = Math.min(pxPerPage, canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      }

      if (pageIndex > 0) {
        doc.addPage('a4', 'portrait');
      }

      const sliceHeightMm = (sliceHeight / canvas.width) * usableWidthMm;
      const sliceData = pageCanvas.toDataURL('image/jpeg', imageQuality);
      doc.addImage(sliceData, 'JPEG', marginMm, marginMm, usableWidthMm, sliceHeightMm, undefined, 'FAST');

      offsetY += sliceHeight;
      pageIndex++;
    }
  }

  const blob = doc.output('blob');
  return { doc, blob, fileName };
};

export const downloadPdfBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
