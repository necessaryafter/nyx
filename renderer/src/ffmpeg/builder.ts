// Monta arrays de args do FFmpeg para cada operação

export class FFmpegBuilder {
  private args: string[] = ["-y"]; // sempre overwrite output

  rawArgs(...values: string[]): this {
    this.args.push(...values);
    return this;
  }

  input(path: string): this {
    this.args.push("-i", path);
    return this;
  }

  streamLoop(count: number): this {
    this.args.push("-stream_loop", String(count));
    return this;
  }

  duration(seconds: number): this {
    this.args.push("-t", String(seconds));
    return this;
  }

  mapStream(spec: string): this {
    this.args.push("-map", spec);
    return this;
  }

  codec(type: "v" | "a", codec: string): this {
    this.args.push(`-c:${type}`, codec);
    return this;
  }

  noAudio(): this {
    this.args.push("-an");
    return this;
  }

  videoFilter(filter: string): this {
    this.args.push("-vf", filter);
    return this;
  }

  complexFilter(filter: string): this {
    this.args.push("-filter_complex", filter);
    return this;
  }

  output(path: string): this {
    this.args.push(path);
    return this;
  }

  build(): string[] {
    return [...this.args];
  }
}
