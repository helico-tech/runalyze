export interface ImageRenderer {
  /** Rasterize a DOM node to a PNG blob. */
  toPngBlob(node: HTMLElement): Promise<Blob>
}
