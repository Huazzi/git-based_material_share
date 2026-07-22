export class StorageProvider {
  get capabilities() {
    throw new Error('Not implemented.');
  }

  async initialize() { throw new Error('Not implemented.'); }
  async refresh() { throw new Error('Not implemented.'); }
  list() { throw new Error('Not implemented.'); }
  search() { throw new Error('Not implemented.'); }
  stat() { throw new Error('Not implemented.'); }
  async readFile() { throw new Error('Not implemented.'); }
  async upload() { throw new Error('Not implemented.'); }
  async createDirectory() { throw new Error('Not implemented.'); }
  async deleteFile() { throw new Error('Not implemented.'); }
  async deleteDirectory() { throw new Error('Not implemented.'); }
  dispose() {}
}
