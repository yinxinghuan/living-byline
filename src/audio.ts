export class SoundEngine {
  private context: AudioContext | null = null

  private ensure() {
    if (!this.context) {
      this.context = new AudioContext()
    }
    if (this.context.state === 'suspended') {
      void this.context.resume()
    }
    return this.context
  }

  pin(index: number) {
    try {
      const ctx = this.ensure()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(520 + index * 120, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.14)
    } catch {
      // Audio is optional.
    }
  }

  complete(final = false) {
    try {
      const ctx = this.ensure()
      const now = ctx.currentTime
      const freqs = final ? [110, 440, 660] : [330, 495]
      freqs.forEach((frequency, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = index === 0 && final ? 'triangle' : 'sine'
        osc.frequency.value = frequency
        gain.gain.setValueAtTime(0.0001, now + index * 0.07)
        gain.gain.exponentialRampToValueAtTime(
          final ? 0.045 : 0.035,
          now + 0.04 + index * 0.07,
        )
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + (final ? 0.62 : 0.36),
        )
        osc.connect(gain).connect(ctx.destination)
        osc.start(now + index * 0.07)
        osc.stop(now + (final ? 0.66 : 0.4))
      })
    } catch {
      // Audio is optional.
    }
  }
}

