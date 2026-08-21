# Design System Direction

## Desired character

The product should feel premium, trustworthy, clean, modern, and calm. Its
visual language should evoke expert hygiene and fabric care without relying on
generic discount-cleaning imagery, loud sales colors, or a disposable template
look.

No final company name, logo, typeface, or marketing art direction is selected
in Phase 0A.

## Experience principles

- Communicate care, precision, and reliability before decoration.
- Make the next useful action obvious on small screens.
- Use restrained color, generous space, clear hierarchy, and legible density.
- Explain price, condition, treatment, and service status in plain language.
- Distinguish warnings, damage, claims, and failed operations without alarmist
  styling.
- Treat accessibility and recovery states as core design quality.
- Keep operational interfaces efficient without making them visually harsh.

## Shared foundations

The public site, customer portal, operations console, and technician workspace
may use different page layouts while sharing:

- color and semantic-status tokens;
- typography scale and reading widths;
- spacing, radius, border, elevation, and motion tokens;
- buttons, links, fields, selectors, dialogs, tables, cards, and notices;
- focus, disabled, pending, selected, validation, and error behavior;
- icon style and illustration principles; and
- accessibility and responsive rules.

Shared primitives must not force the public site and operations console into
the same information density.

## Initial token direction

The Phase 0A shell uses provisional tokens only:

- warm off-white and mineral green surfaces;
- deep green ink rather than pure black;
- a restrained hygienic green accent;
- subtle borders and low-chroma shadows;
- large but controlled radius;
- native system typography to avoid external font dependencies.

These values demonstrate structure and may be revised during the public-site
design phase. They are not final brand assets.

## Layout direction by surface

### Public website

- editorial spacing and confident service explanation;
- clear quote or booking path without constant sales pressure;
- strong mobile reading order;
- proof, process, care, and expectation-setting content;
- localized content for the intended audience once copy is approved.

### Customer portal

- task-oriented overview of requests, appointments, properties, documents, and
  cleaning history;
- plain status explanations and next actions;
- strong empty and first-use guidance.

### Admin and dispatcher console

- denser workspace with consistent filters, tables, queues, and calendars;
- persistent context and safe bulk actions;
- visible status provenance, ownership, and exception handling.

### Technician workspace

- mobile-first, touch-friendly controls;
- high contrast in varied working conditions;
- short steps, autosave strategy, and explicit sync state;
- camera, inspection, treatment, and completion flows designed for one-handed
  use where practical.

## Responsive requirements

- Start at 320 CSS pixels without horizontal page scrolling.
- Use content-led breakpoints rather than device names.
- Keep primary actions reachable and adequately sized for touch.
- Reflow tables into an accessible small-screen pattern when necessary.
- Avoid hover-only meaning and pointer-only interactions.
- Test text enlargement and narrow landscape layouts.

## Accessibility baseline

- Semantic landmarks, headings, lists, tables, and form relationships
- Keyboard-operable interactions with visible focus
- Programmatic names for controls and meaningful icons
- Sufficient text, control, and status contrast
- Error identification connected to the relevant field
- Status communication that does not depend on color alone
- Respect for reduced-motion and reduced-transparency preferences
- Logical reading and focus order

Target WCAG 2.2 AA for customer-facing and staff-facing workflows.

## Required product states

Each data-backed product surface must design and implement, as applicable:

- initial loading and incremental loading;
- empty first-use and empty filtered results;
- validation and permission errors;
- recoverable network or server errors;
- unavailable dependencies;
- success confirmation;
- stale or offline state;
- disabled and in-progress actions; and
- destructive-action confirmation.

Skeletons are appropriate only when they communicate likely structure. Use
plain progress or status messaging when skeletons would mislead.
