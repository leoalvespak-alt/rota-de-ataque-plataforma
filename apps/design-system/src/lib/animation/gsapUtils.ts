import gsap from 'gsap'

export function createBrandTimeline(target: gsap.TweenTarget) {
  return gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.4 } }).to(target, {})
}

export function animateSvgPath(
  selector: string,
  options?: { duration?: number; stagger?: number; ease?: string },
) {
  const { duration = 1, stagger = 0.1, ease = 'power2.inOut' } = options ?? {}
  gsap.fromTo(
    selector,
    {
      strokeDashoffset: (_: number, el: Element) =>
        'getTotalLength' in el ? (el as SVGGeometryElement).getTotalLength() : 0,
      opacity: 0,
    },
    { strokeDashoffset: 0, opacity: 1, duration, stagger, ease },
  )
}

export function animateCounter(
  target: HTMLElement,
  endValue: number,
  options?: { duration?: number; prefix?: string; suffix?: string },
) {
  const { duration = 1, prefix = '', suffix = '' } = options ?? {}
  gsap.to(
    { val: 0 },
    {
      val: endValue,
      duration,
      ease: 'power2.out',
      onUpdate() {
        const current = Math.round(this.targets()[0].val as number)
        target.textContent = `${prefix}${current.toLocaleString('pt-BR')}${suffix}`
      },
    },
  )
}
