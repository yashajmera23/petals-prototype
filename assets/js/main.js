// Header: border once the page scrolls, mobile menu toggle, Expertise dropdown.
const header = document.querySelector('.site-header');
const nav = document.querySelector('.primary-nav');
const menuToggle = document.querySelector('.menu-toggle');
const dropdownToggle = document.querySelector('[data-dropdown-toggle]');
const dropdown = document.getElementById(dropdownToggle?.getAttribute('aria-controls'));

const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const setMenu = (open) => {
	nav.dataset.open = String(open);
	menuToggle.setAttribute('aria-expanded', String(open));
	menuToggle.querySelector('span').textContent = open ? 'Close' : 'Menu';
};
const mobile = window.matchMedia('(max-width: 960px)');
const syncNav = () => setMenu(false);
syncNav();
mobile.addEventListener('change', () => {
	syncNav();
	if (!mobile.matches) nav.removeAttribute('data-open');
});
if (!mobile.matches) nav.removeAttribute('data-open');
menuToggle.addEventListener('click', () => setMenu(nav.dataset.open !== 'true'));

const setDropdown = (open) => {
	dropdownToggle.setAttribute('aria-expanded', String(open));
	dropdown.hidden = !open;
};
dropdownToggle.addEventListener('click', () => setDropdown(dropdown.hidden));
document.addEventListener('click', (e) => {
	if (!mobile.matches && !e.target.closest('.has-dropdown')) setDropdown(false);
});
document.addEventListener('keydown', (e) => {
	if (e.key !== 'Escape') return;
	if (!dropdown.hidden) { setDropdown(false); dropdownToggle.focus(); }
	else if (mobile.matches && nav.dataset.open === 'true') { setMenu(false); menuToggle.focus(); }
});

// Hero ground model. One timeline from 0 to 1: the page-load entrance settles the layers into a
// closed stack and starts to open it (0 → 0.35); scrolling opens it fully and names each layer
// (0.35 → 1). While it opens, the hero stage is pinned so the model stays in view.
// Without this script, or with reduced motion, the model is shown open and nothing pins.
const hero = document.querySelector('.hero');
const model = document.querySelector('.hero-model');
if (hero && model) {
	const track = hero.querySelector('.hero-track');
	const layers = [...model.querySelectorAll('.model-layer')]; // bottom to top
	// Offsets in picture px (box is 720 tall): closed stack → fully open
	const CLOSED = { foundations: -18, block: 0, rock: 40, grid: 70, survey: 104 };
	const OPEN = { foundations: 26, block: 0, rock: -8, grid: -22, survey: -38 };
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const ENTRANCE_SHARE = 0.35;
	const ENTRANCE_MS = 1500;
	const clamp01 = (v) => Math.min(1, Math.max(0, v));
	const ease = (x) => 1 - Math.pow(1 - x, 3);

	// Design-review aid: ?drawing=0.5 freezes the timeline at a given point for screenshots.
	const frozen = Number.parseFloat(new URLSearchParams(location.search).get('drawing'));

	let intro = 0;
	let scrollProgress = 0;
	let queued = 0;

	const render = () => {
		queued = 0;
		const t = Number.isFinite(frozen) ? clamp01(frozen)
			: reduceMotion.matches ? 1 : ENTRANCE_SHARE * intro + (1 - ENTRANCE_SHARE) * scrollProgress;
		const open = ease(t);
		layers.forEach((layer, i) => {
			const name = layer.className.match(/model-(\w+)$/)[1];
			const px = CLOSED[name] + (OPEN[name] - CLOSED[name]) * open;
			layer.style.setProperty('--y', (px / 720 * 100).toFixed(3));
			// labels appear one by one, top layer first, as the stack opens
			const order = layers.length - 1 - i;
			layer.style.setProperty('--label', clamp01((t - 0.42 - order * 0.1) / 0.12).toFixed(3));
		});
	};
	const schedule = () => { if (!queued) queued = requestAnimationFrame(render); };

	const canPin = () => !reduceMotion.matches && !Number.isFinite(frozen) && window.innerHeight >= 600;
	const onScroll = () => {
		if (hero.classList.contains('is-pinned')) {
			const stage = track.firstElementChild;
			const travel = Math.max(1, track.offsetHeight - stage.offsetHeight);
			const passed = window.scrollY - (track.getBoundingClientRect().top + window.scrollY);
			scrollProgress = clamp01(passed / travel);
		} else {
			scrollProgress = 1;
		}
		schedule();
	};
	const layout = () => { hero.classList.toggle('is-pinned', canPin()); onScroll(); };

	const playIntro = () => {
		const start = performance.now();
		const step = (now) => {
			intro = clamp01((now - start) / ENTRANCE_MS);
			render();
			if (intro < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	};

	layout();
	render();
	if (reduceMotion.matches) intro = 1;
	else playIntro();

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', layout);
	reduceMotion.addEventListener('change', () => { intro = 1; layout(); render(); });
}

// Hero photo band: enters at the content width and opens to the screen edges as it scrolls in.
// Without this script, or with reduced motion, the band is simply full-bleed.
const band = document.querySelector('.hero-band');
if (band) {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const guide = band.querySelector('.container');
	let queued = 0;

	const update = () => {
		queued = 0;
		if (reduceMotion.matches) {
			band.style.removeProperty('--band-inset');
			band.style.removeProperty('--band-radius');
			return;
		}
		const rect = band.getBoundingClientRect();
		const vh = window.innerHeight;
		// 0 when the band's top meets the bottom of the screen, 1 once it has risen 65% of the way up.
		const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.65)));
		const eased = 1 - Math.pow(1 - p, 3);
		const contentEdge = guide.getBoundingClientRect().left + parseFloat(getComputedStyle(guide).paddingLeft);
		band.style.setProperty('--band-inset', `${(contentEdge * (1 - eased)).toFixed(1)}px`);
		band.style.setProperty('--band-radius', `${(4 * (1 - eased)).toFixed(2)}px`);
	};
	const schedule = () => { if (!queued) queued = requestAnimationFrame(update); };

	update();
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule);
	reduceMotion.addEventListener('change', update);
}

// Hero photo slideshow: crossfades every INTERVAL ms. Pauses on hover, keyboard focus, when
// off screen or in a background tab, and when the visitor presses pause. With reduced motion it
// never advances on its own; the slide buttons still work.
const slideshow = document.querySelector('.hero-band[aria-roledescription="carousel"]');
if (slideshow) {
	const INTERVAL = 6000;
	const slides = [...slideshow.querySelectorAll('.band-slide')];
	const dotsWrap = slideshow.querySelector('.band-dots');
	const pauseBtn = slideshow.querySelector('.band-pause');
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	slideshow.style.setProperty('--band-interval', `${INTERVAL}ms`);

	let current = 0;
	let timer = 0;
	let startedAt = 0;
	let remaining = INTERVAL;
	const holds = new Set(); // reasons the slideshow is currently held: hover, focus, offscreen, hidden, user

	const dots = slides.map((_, i) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'band-dot';
		b.setAttribute('aria-label', `Show slide ${i + 1} of ${slides.length}`);
		b.addEventListener('click', () => show(i));
		dotsWrap.append(b);
		return b;
	});

	const restartProgress = (dot) => {
		// Re-trigger the CSS progress animation on the current segment.
		dot.removeAttribute('aria-current');
		void dot.offsetWidth;
		dot.setAttribute('aria-current', 'true');
	};

	function show(index) {
		current = (index + slides.length) % slides.length;
		slides.forEach((s, i) => {
			const on = i === current;
			s.classList.toggle('is-active', on);
			s.setAttribute('aria-hidden', String(!on));
		});
		dots.forEach((d, i) => { if (i !== current) d.removeAttribute('aria-current'); });
		restartProgress(dots[current]);
		remaining = INTERVAL;
		schedule();
	}

	const schedule = () => {
		clearTimeout(timer);
		const held = holds.size > 0 || reduceMotion.matches;
		slideshow.classList.toggle('is-paused', held);
		if (held) return;
		startedAt = performance.now();
		timer = setTimeout(() => show(current + 1), remaining);
	};
	const hold = (reason) => {
		if (holds.has(reason)) return;
		if (holds.size === 0) remaining = Math.max(0, remaining - (performance.now() - startedAt));
		holds.add(reason);
		schedule();
	};
	const release = (reason) => {
		if (!holds.delete(reason)) return;
		schedule();
	};

	const syncPauseButton = () => {
		const paused = holds.has('user');
		slideshow.classList.toggle('is-user-paused', paused);
		pauseBtn.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
	};
	pauseBtn.addEventListener('click', () => {
		if (holds.has('user')) release('user'); else hold('user');
		syncPauseButton();
	});

	// Previous / next buttons, ← → keys while the slideshow has focus, and horizontal swipe on touch.
	slideshow.querySelector('.band-prev').addEventListener('click', () => show(current - 1));
	slideshow.querySelector('.band-next').addEventListener('click', () => show(current + 1));
	slideshow.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
		if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
	});
	const swipeArea = slideshow.querySelector('.band-slides');
	let swipeStart = null;
	swipeArea.addEventListener('pointerdown', (e) => {
		if (e.pointerType === 'mouse') return;
		swipeStart = { x: e.clientX, y: e.clientY };
	});
	swipeArea.addEventListener('pointerup', (e) => {
		if (!swipeStart) return;
		const dx = e.clientX - swipeStart.x;
		const dy = e.clientY - swipeStart.y;
		swipeStart = null;
		if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
	});
	swipeArea.addEventListener('pointercancel', () => { swipeStart = null; });

	slideshow.addEventListener('pointerenter', () => hold('hover'));
	slideshow.addEventListener('pointerleave', () => release('hover'));
	slideshow.addEventListener('focusin', () => hold('focus'));
	slideshow.addEventListener('focusout', (e) => { if (!slideshow.contains(e.relatedTarget)) release('focus'); });
	document.addEventListener('visibilitychange', () => (document.hidden ? hold('hidden') : release('hidden')));
	new IntersectionObserver(([entry]) => (entry.isIntersecting ? release('offscreen') : hold('offscreen')), { threshold: 0.25 }).observe(slideshow);
	reduceMotion.addEventListener('change', schedule);

	holds.add('offscreen'); // released by the observer once the band is in view
	show(0);
}

// How We Work: each step's drawing loops only while its card is on screen, and the step
// crossing the middle of the viewport has its number marked in copper.
const steps = [...document.querySelectorAll('.steps > .step')];
if (steps.length) {
	const live = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-live', e.isIntersecting)), { threshold: 0.2 });
	const middle = new IntersectionObserver((entries) => entries.forEach((e) => {
		if (e.isIntersecting) steps.forEach((s) => s.classList.toggle('is-current', s === e.target));
	}), { rootMargin: '-45% 0px -45% 0px' });
	steps.forEach((s) => { live.observe(s); middle.observe(s); });
}

// How We Work, step 3: the scope switch shows which stream a project would use; the other steps back.
document.querySelectorAll('.step-streams').forEach((block) => {
	const buttons = [...block.querySelectorAll('.scope-switch button')];
	buttons.forEach((btn) => btn.addEventListener('click', () => {
		block.dataset.scope = btn.dataset.show;
		buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
	}));
});

// About, Why PETALS: tabs over eight strengths. Steps on by itself every few seconds; pointer,
// focus, an offscreen section or a hidden tab hold it. Arrow keys move between tabs.
const why = document.querySelector('.why');
if (why) {
	const tabs = [...why.querySelectorAll('.why-tab')];
	const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
	const INTERVAL = 4500;
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
	const holds = new Set();
	let current = 0;
	let timer = null;

	function select(i, focus) {
		current = (i + tabs.length) % tabs.length;
		tabs.forEach((t, k) => {
			const on = k === current;
			t.setAttribute('aria-selected', String(on));
			t.tabIndex = on ? 0 : -1;
			panels[k].classList.toggle('is-active', on);
		});
		if (focus) tabs[current].focus();
		schedule();
	}
	function schedule() {
		clearTimeout(timer);
		why.classList.toggle('is-held', holds.size > 0);
		if (!holds.size && !reduce.matches) timer = setTimeout(() => select(current + 1), INTERVAL);
	}
	const hold = (r) => { holds.add(r); schedule(); };
	const release = (r) => { holds.delete(r); schedule(); };

	tabs.forEach((t, i) => {
		t.addEventListener('click', () => select(i));
		t.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
		t.addEventListener('keydown', (e) => {
			const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
			if (step) { e.preventDefault(); select(current + step, true); }
		});
	});
	const layout = why.querySelector('.why-layout');
	layout.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold('hover'); });
	layout.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') release('hover'); });
	why.addEventListener('focusin', () => hold('focus'));
	why.addEventListener('focusout', (e) => { if (!why.contains(e.relatedTarget)) release('focus'); });
	new IntersectionObserver(([en]) => (en.isIntersecting ? release('offscreen') : hold('offscreen')), { threshold: 0.3 }).observe(layout);
	document.addEventListener('visibilitychange', () => (document.hidden ? hold('hidden') : release('hidden')));

	why.style.setProperty('--why-interval', `${INTERVAL}ms`);
	why.classList.add('is-cycling');
	holds.add('offscreen');
	select(0);
}
// About, Delivery model: pointing at (or focusing) a row lights its ring in the diagram.
const dmFigure = document.querySelector('.dm-figure');
if (dmFigure) {
	document.querySelectorAll('.dm-list li').forEach((li) => {
		const on = () => { dmFigure.dataset.focus = li.dataset.ring; li.classList.add('is-on'); };
		const off = () => { delete dmFigure.dataset.focus; li.classList.remove('is-on'); };
		li.addEventListener('pointerenter', on);
		li.addEventListener('pointerleave', off);
		li.addEventListener('focus', on);
		li.addEventListener('blur', off);
	});
}

// Cursor trail: a small copper square follows the pointer and draws a fading line behind it,
// like a pen tracing on a drawing sheet. It sits over interactive elements as an outline.
// Fine pointers with motion allowed only; the system cursor stays as it is.
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
	const canvas = document.createElement('canvas');
	canvas.className = 'cursor-trail';
	canvas.setAttribute('aria-hidden', 'true');
	document.body.append(canvas);
	const ctx = canvas.getContext('2d');
	const LIFE = 420; // ms a point of the line stays visible
	const COPPER = getComputedStyle(document.documentElement).getPropertyValue('--color-copper').trim() || '#c28050';
	let dpr = 1;
	let pts = [];
	let head = null; // eased square position
	let target = null;
	let overLink = 0; // 0..1, eases toward 1 over links and buttons
	let wantLink = 0;
	let running = false;

	const size = () => {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = innerWidth * dpr;
		canvas.height = innerHeight * dpr;
	};
	size();
	window.addEventListener('resize', size);

	window.addEventListener('pointermove', (e) => {
		if (e.pointerType !== 'mouse') return;
		target = { x: e.clientX, y: e.clientY };
		if (!head) head = { ...target };
		pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
		wantLink = e.target instanceof Element && e.target.closest('a, button, summary, [role="tab"], [tabindex="0"]') ? 1 : 0;
		if (!running) { running = true; requestAnimationFrame(draw); }
	}, { passive: true });
	document.addEventListener('pointerleave', () => { target = null; head = null; });

	function draw(now) {
		pts = pts.filter((p) => now - p.t < LIFE);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, innerWidth, innerHeight);

		// the line: smoothed through midpoints, fading and thinning toward its tail
		ctx.lineCap = 'round';
		for (let i = 1; i < pts.length - 1; i++) {
			const a = pts[i - 1], b = pts[i], c = pts[i + 1];
			const life = 1 - (now - b.t) / LIFE;
			ctx.strokeStyle = COPPER;
			ctx.globalAlpha = Math.max(0, life) * 0.9;
			ctx.lineWidth = 0.6 + life * 1.4;
			ctx.beginPath();
			ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
			ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
			ctx.stroke();
		}

		// the square: eases after the pointer; over a link it opens into a larger outline
		if (target && head) {
			head.x += (target.x - head.x) * 0.35;
			head.y += (target.y - head.y) * 0.35;
			overLink += (wantLink - overLink) * 0.2;
			const s = 9 + overLink * 13;
			ctx.globalAlpha = 1;
			ctx.save();
			ctx.translate(head.x, head.y);
			ctx.rotate(overLink * Math.PI / 4);
			if (overLink > 0.5) {
				ctx.strokeStyle = COPPER;
				ctx.lineWidth = 1.5;
				ctx.strokeRect(-s / 2, -s / 2, s, s);
			} else {
				ctx.fillStyle = COPPER;
				ctx.fillRect(-s / 2, -s / 2, s, s);
			}
			ctx.restore();
		}
		ctx.globalAlpha = 1;

		const settled = !pts.length && (!target || (Math.abs(target.x - head.x) < 0.3 && Math.abs(target.y - head.y) < 0.3 && Math.abs(wantLink - overLink) < 0.01));
		if (settled) { running = false; return; }
		requestAnimationFrame(draw);
	}
}
