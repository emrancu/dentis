export class R2RecordingStore {
  constructor(bucket) {
    this.bucket = bucket;
  }

  async put(key, body, contentType) {
    await this.bucket.put(key, body, { httpMetadata: { contentType } });
  }

  async get(key) {
    const object = await this.bucket.get(key);
    return object ? { body: object.body, contentType: object.httpMetadata?.contentType ?? 'audio/webm' } : null;
  }
}
