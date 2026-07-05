import * as htmlToImage from 'html-to-image'
import type { ImageRenderer } from '../../domain/ports/image-renderer'

export class HtmlImageRenderer implements ImageRenderer {
  async toPngBlob(node: HTMLElement): Promise<Blob> {
    const blob = await htmlToImage.toBlob(node, { pixelRatio: 2, cacheBust: true })
    if (!blob) throw new Error('image rendering produced no data')
    return blob
  }
}
