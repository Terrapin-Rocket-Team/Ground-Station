class CacheTile {
  constructor(blobParts, coords) {
    this.blob = new Blob(blobParts);
    this.coords = coords;
    this.url;
  }
  getURL() {
    if (this.url) return this.url;
    return (this.url = URL.createObjectURL(this.blob));
  }
  deleteBlob() {
    URL.revokeObjectURL(this.url);
    this.blob = null;
  }
}
