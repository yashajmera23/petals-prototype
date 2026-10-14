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

// Hero section drawing. One timeline from 0 to 1: the page-load entrance draws the site and the
// ground investigation (0 → 0.5); scrolling raises the frame storey by storey (0.5 → 1).
// While the frame builds, the hero stage is pinned so the drawing stays in view.
// Without this script, or with reduced motion, the drawing is shown complete and nothing pins.
const hero = document.querySelector('.hero');
const drawing = document.querySelector('.section-drawing');
if (hero && drawing) {
	const track = hero.querySelector('.hero-track');
	const windows = (attr) => [...drawing.querySelectorAll(`[${attr}]`)].map((el) => {
		const [from, to] = el.getAttribute(attr).split(',').map(Number);
		return { el, from, to };
	});
	const strokes = windows('data-draw');
	const fades = windows('data-fade');
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const narrow = window.matchMedia('(max-width: 860px)');
	const wideViewBox = drawing.getAttribute('viewBox');
	const narrowViewBox = drawing.dataset.viewboxNarrow || wideViewBox;
	const ENTRANCE_SHARE = 0.5;
	const ENTRANCE_MS = 1600;
	const clamp01 = (v) => Math.min(1, Math.max(0, v));
	const easeOut = (x) => 1 - Math.pow(1 - x, 3);

	// Design-review aid: ?drawing=0.5 freezes the timeline at a given point for screenshots.
	const pinned = Number.parseFloat(new URLSearchParams(location.search).get('drawing'));

	let intro = 0;
	let scrollProgress = 0;
	let queued = 0;

	const render = () => {
		queued = 0;
		const t = Number.isFinite(pinned) ? clamp01(pinned)
			: reduceMotion.matches ? 1 : ENTRANCE_SHARE * intro + (1 - ENTRANCE_SHARE) * scrollProgress;
		for (const s of strokes) s.el.style.strokeDashoffset = String(1 - clamp01((t - s.from) / (s.to - s.from)));
		for (const f of fades) f.el.style.opacity = String(clamp01((t - f.from) / (f.to - f.from)));
	};
	const schedule = () => { if (!queued) queued = requestAnimationFrame(render); };

	// Pin only when it can work well: motion allowed and a screen tall enough for the stage.
	const canPin = () => !reduceMotion.matches && !Number.isFinite(pinned) && window.innerHeight >= 600;
	const layout = () => {
		hero.classList.toggle('is-pinned', canPin());
		drawing.setAttribute('viewBox', narrow.matches ? narrowViewBox : wideViewBox);
		drawing.setAttribute('preserveAspectRatio', narrow.matches ? 'xMidYMid meet' : 'xMidYMax meet');
		onScroll();
	};
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

	const playIntro = () => {
		const start = performance.now();
		const step = (now) => {
			intro = easeOut(clamp01((now - start) / ENTRANCE_MS));
			render();
			if (intro < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	};

	drawing.classList.add('is-live');
	layout();
	render();

	if (reduceMotion.matches) {
		intro = 1;
	} else {
		const io = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) { io.disconnect(); playIntro(); }
		}, { threshold: 0.2 });
		io.observe(drawing);
	}

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

// How We Work chain: drawn once, node by node, when the section comes into view.
// Without this script, or with reduced motion, the chain is simply shown complete.
const processChain = document.querySelector('.process');
if (processChain && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
	processChain.classList.add('is-armed');
	new IntersectionObserver((entries, io) => {
		if (!entries.some((e) => e.isIntersecting)) return;
		processChain.classList.add('is-drawn');
		io.disconnect();
	}, { threshold: 0.35 }).observe(processChain);
}

// Client logos: the row is repeated to fill the strip, then drifts left. Scrolling the page
// pushes it along in the same direction, the pointer brings it to rest, and it can be dragged
// or flicked. Without this script, or with reduced motion, the strip is a static row.
const clients = document.querySelector('.clients');
if (clients && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
	const marquee = clients.querySelector('.marquee');
	const track = clients.querySelector('.marquee-track');
	const pauseBtn = clients.querySelector('.marquee-pause');
	const originals = [...track.children];
	const BASE = 34; // drift speed, px per second
	const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

	let period = 0; // width of one full set of logos
	let x = 0;
	let v = BASE;
	let dir = 1; // 1 = leftward; flips with page scroll direction
	let kick = 0; // extra speed from page scrolling, decays
	let hovering = false;
	let userPaused = false;
	let drag = null;
	let running = false;
	let last = 0;
	let lastY = window.scrollY;

	function fill() {
		track.querySelectorAll('[data-clone]').forEach((n) => n.remove());
		period = track.getBoundingClientRect().width;
		if (!period) return;
		const sets = Math.ceil(marquee.clientWidth / period) + 1;
		for (let s = 0; s < sets; s++) {
			originals.forEach((item) => {
				const copy = item.cloneNode(true);
				copy.dataset.clone = '';
				copy.setAttribute('aria-hidden', 'true');
				track.append(copy);
			});
		}
	}

	function frame(now) {
		if (!running) return;
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;

		const y = window.scrollY;
		const dy = y - lastY;
		lastY = y;
		if (dy && !userPaused) {
			dir = dy > 0 ? 1 : -1;
			kick = clamp(kick + dy * 2.5, -520, 520);
		}
		kick *= Math.exp(-dt * 3);

		if (!(drag && drag.axis === 'x')) {
			const target = hovering || userPaused ? 0 : BASE * dir;
			v += (target - v) * (1 - Math.exp(-dt * 3));
			x += (v + kick) * dt;
		}
		if (period) x = ((x % period) + period) % period;
		track.style.transform = `translate3d(${-x}px, 0, 0)`;
		requestAnimationFrame(frame);
	}

	function start() {
		if (running || document.hidden) return;
		// Logos sitting off to the side never cross the viewport, so lazy loading would leave
		// them blank as they slide in. Load the lot once the strip is near.
		track.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
		running = true;
		last = performance.now();
		lastY = window.scrollY;
		requestAnimationFrame(frame);
	}
	const stop = () => { running = false; };

	marquee.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
	marquee.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hovering = false; });

	// Drag or flick sideways; a vertical swipe is left to the page
	marquee.addEventListener('pointerdown', (e) => {
		if (e.button !== 0) return;
		drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: performance.now(), v: 0, axis: null };
	});
	marquee.addEventListener('pointermove', (e) => {
		if (!drag || e.pointerId !== drag.id) return;
		if (!drag.axis) {
			const ax = Math.abs(e.clientX - drag.x0);
			const ay = Math.abs(e.clientY - drag.y0);
			if (ax < 5 && ay < 5) return;
			drag.axis = ax > ay ? 'x' : 'y';
			if (drag.axis === 'x') {
				marquee.setPointerCapture(e.pointerId);
				marquee.classList.add('is-dragging');
			}
		}
		if (drag.axis !== 'x') return;
		const now = performance.now();
		const dx = e.clientX - drag.x;
		x -= dx;
		drag.v = (-dx / Math.max(8, now - drag.t)) * 1000;
		drag.x = e.clientX;
		drag.t = now;
	});
	const endDrag = (e) => {
		if (!drag || e.pointerId !== drag.id) return;
		if (drag.axis === 'x') {
			// A flick keeps its speed for a moment, then eases back to the drift
			v = performance.now() - drag.t < 80 ? clamp(drag.v, -1600, 1600) : 0;
			marquee.classList.remove('is-dragging');
		}
		drag = null;
	};
	marquee.addEventListener('pointerup', endDrag);
	marquee.addEventListener('pointercancel', endDrag);

	pauseBtn.hidden = false;
	pauseBtn.addEventListener('click', () => {
		userPaused = !userPaused;
		clients.classList.toggle('is-user-paused', userPaused);
		pauseBtn.setAttribute('aria-label', userPaused ? 'Play logo strip' : 'Pause logo strip');
		if (userPaused) kick = 0;
	});

	new ResizeObserver(fill).observe(marquee);
	new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { rootMargin: '200px 0px' }).observe(marquee);
	document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

	clients.classList.add('is-live');
	fill();
}
