/**
 * Slide-knob buttons: a knob with a pixel chevron sits at the start of the pill and slides to the end on
 * hover or focus while the label moves the other way. The CSS animates `transform` only; the only thing
 * JavaScript does is measure how far the knob has to travel, because the label (and so the width) changes
 * with the language and the font.
 */

/** The shell's inner width minus the knob and its two insets. Never negative. */
export const knobTravel = (shellWidth, knobWidth, inset) => Math.max(0, shellWidth - knobWidth - 2 * inset);

/** The label moves left by knob + inset + gap − end padding, so it lands where the knob started. */
export const labelShift = ({ knob, inset, gap, end }) => knob + inset + gap - end;

function measure(button) {
  const knob = button.querySelector('.kb__knob');
  if (!knob) return;
  const inset = parseFloat(getComputedStyle(button).getPropertyValue('--kb-inset')) || 5;
  button.style.setProperty('--kb-travel', `${knobTravel(button.offsetWidth, knob.offsetWidth, inset)}px`);
}

export function initKnobButtons(root = document) {
  const buttons = [...root.querySelectorAll('.kb')];
  const observer = new ResizeObserver((entries) => entries.forEach((entry) => measure(entry.target)));
  buttons.forEach((button) => {
    measure(button);
    observer.observe(button); // a new label (language switch) or a shown button changes the width
  });
  document.fonts?.ready.then(() => buttons.forEach(measure));
  return observer;
}
