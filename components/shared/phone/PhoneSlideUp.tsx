/** One definition of the phone slide-up entry (PhonePattern.md « Opening a row »). Render <PhoneSlideUpStyle /> once next to the element that uses the class. */
export const PHONE_SLIDE_UP_CLASS = 'phone-slide-up'

const CSS = `
@keyframes phoneSlideUp { from { transform: translateY(24px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
.${PHONE_SLIDE_UP_CLASS} { animation: phoneSlideUp 180ms ease-out; }
@media (prefers-reduced-motion: reduce) { .${PHONE_SLIDE_UP_CLASS} { animation: none; } }
`

export function PhoneSlideUpStyle() {
  return <style>{CSS}</style>
}
