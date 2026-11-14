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

// Careers, team row: while motion is allowed on a wide, tall-enough screen, the section pins and
// vertical scrolling slides the row right to left. Otherwise the row is a plain sideways scroller.
// The arrows step one card either way in both modes.
const team = document.querySelector('.team');
if (team) {
	const track = team.querySelector('.team-track');
	const stage = team.querySelector('.team-stage');
	const viewport = team.querySelector('.team-viewport');
	const row = team.querySelector('.team-row');
	const bar = team.querySelector('.team-progress span');
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
	const HEADER = 56;
	let pinned = false;
	let dist = 0;

	const canPin = () => !reduce.matches && window.innerWidth > 760 && window.innerHeight >= 600;
	const update = () => {
		let p;
		if (pinned) {
			const top = track.getBoundingClientRect().top + window.scrollY;
			p = dist ? Math.min(1, Math.max(0, (window.scrollY + HEADER - top) / dist)) : 0;
			row.style.transform = `translate3d(${-p * dist}px, 0, 0)`;
		} else {
			row.style.transform = '';
			p = dist ? viewport.scrollLeft / dist : 0;
		}
		bar.style.transform = `scaleX(${p.toFixed(4)})`;
	};
	const layout = () => {
		pinned = canPin();
		team.classList.toggle('is-pinned', pinned);
		row.style.transform = '';
		dist = Math.max(0, row.scrollWidth - viewport.clientWidth);
		track.style.height = pinned ? `${stage.offsetHeight + dist}px` : '';
		update();
	};
	const step = (dir) => {
		const card = row.firstElementChild;
		const by = (card.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap || 0)) * dir;
		if (pinned) window.scrollBy({ top: by, behavior: reduce.matches ? 'auto' : 'smooth' });
		else viewport.scrollBy({ left: by, behavior: reduce.matches ? 'auto' : 'smooth' });
	};
	team.querySelector('.team-prev').addEventListener('click', () => step(-1));
	team.querySelector('.team-next').addEventListener('click', () => step(1));
	window.addEventListener('scroll', () => { if (pinned) update(); }, { passive: true });
	viewport.addEventListener('scroll', () => { if (!pinned) update(); }, { passive: true });
	window.addEventListener('resize', layout);
	window.addEventListener('load', layout);
	layout();
}

// Careers, openings: ?openings=0 previews the empty state the page shows when no vacancy is published.
// "Apply" on a card carries its role into the form.
const jobList = document.querySelector('.job-list');
if (jobList) {
	if (new URLSearchParams(location.search).get('openings') === '0') {
		jobList.hidden = true;
		document.querySelector('.openings-empty').hidden = false;
		document.querySelector('.openings-count').textContent = 'No open roles right now';
	}
	const roleSelect = document.getElementById('f-role');
	jobList.querySelectorAll('.job-apply').forEach((a) => a.addEventListener('click', () => { roleSelect.value = a.dataset.role; }));
}

// Careers, Share Your Profile: checks each field with a plain message beside it, then shows the
// thank-you state. The prototype sends nothing.
const applyForm = document.querySelector('.apply-form');
if (applyForm) {
	const cv = applyForm.querySelector('#f-cv');
	const zone = applyForm.querySelector('.dropzone');
	const zoneText = zone.querySelector('.dz-text');
	const MAX = 5 * 1024 * 1024;
	const messages = {
		name: 'Please enter your full name.',
		email: 'Please enter a valid email address, like name@company.com.',
		phone: 'Please enter a phone number with at least 10 digits.',
		location: 'Please enter the city you are based in.',
		discipline: 'Please choose a discipline.',
		experience: 'Please choose your experience.',
		consent: 'Please agree to the privacy notice so we can store your details.',
	};
	const errorOf = (el) => el.closest('.field').querySelector('.field-error');
	const cvProblem = () => {
		const f = cv.files[0];
		if (!f) return 'Please attach your CV.';
		if (!/\.(pdf|docx?)$/i.test(f.name)) return 'Please attach a PDF or Word file.';
		if (f.size > MAX) return 'This file is larger than 5 MB. Please attach a smaller file.';
		return '';
	};
	const check = (el) => {
		let msg = '';
		if (el === cv) msg = cvProblem();
		else if (!el.checkValidity()) msg = messages[el.name] || 'Please fill in this field.';
		errorOf(el).textContent = msg;
		el.setAttribute('aria-invalid', String(Boolean(msg)));
		if (el === cv) zone.classList.toggle('is-invalid', Boolean(msg));
		return !msg;
	};
	const fields = [...applyForm.querySelectorAll('input, select')].filter((el) => el.required);
	fields.forEach((el) => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' || el === cv ? 'change' : 'blur', () => check(el)));

	cv.addEventListener('change', () => {
		const f = cv.files[0];
		zone.classList.toggle('has-file', Boolean(f));
		zoneText.innerHTML = f ? `<b>${f.name.replace(/[<>&]/g, '')}</b> · ${(f.size / 1048576).toFixed(1)} MB` : '<b>Drop your CV here</b> or click to choose';
	});
	['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, () => zone.classList.add('is-over')));
	['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, () => zone.classList.remove('is-over')));

	applyForm.addEventListener('submit', (e) => {
		e.preventDefault();
		const results = fields.map(check);
		const firstBad = fields[results.indexOf(false)];
		if (firstBad) { firstBad.focus(); return; }
		applyForm.hidden = true;
		const done = document.querySelector('.apply-done');
		done.hidden = false;
		done.focus();
	});
}

// How We Work page, stage ruler: marks the stage crossing the middle of the screen and fills
// the copper rule up to it. The links jump to each stage.
const ruler = document.querySelector('.stage-ruler');
if (ruler) {
	const links = [...ruler.querySelectorAll('a[data-stage]')];
	const fill = ruler.querySelector('.ruler-fill');
	const setStage = (n) => {
		links.forEach((a) => a.classList.toggle('is-current', Number(a.dataset.stage) === n));
		links.forEach((a) => a.classList.toggle('is-done', Number(a.dataset.stage) < n));
		fill.style.transform = `scaleX(${(n / links.length).toFixed(3)})`;
	};
	const io = new IntersectionObserver((entries) => entries.forEach((e) => {
		if (e.isIntersecting) setStage(Number(e.target.id.split('-')[1]));
	}), { rootMargin: '-45% 0px -45% 0px' });
	links.forEach((a) => { const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) io.observe(t); });
	setStage(0);
}

// Insights: category chips and search filter the cards together; an empty result shows a note.
const insGrid = document.querySelector('.ins-library .ins-grid');
if (insGrid) {
	const cards = [...insGrid.children];
	const chips = [...document.querySelectorAll('.ins-filters .chip')];
	const search = document.querySelector('.ins-search input');
	const status = document.querySelector('.ins-status');
	const empty = document.querySelector('.ins-empty');
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
	let cat = 'all';
	const apply = () => {
		const q = search.value.trim().toLowerCase();
		let shown = 0;
		cards.forEach((c) => {
			const ok = (cat === 'all' || c.dataset.cat === cat) && (!q || c.textContent.toLowerCase().includes(q));
			c.hidden = !ok;
			if (ok) {
				shown++;
				if (!reduce.matches) { c.classList.remove('is-in'); void c.offsetWidth; c.classList.add('is-in'); }
			}
		});
		// the first visible card takes the wide "feature" slot only when nothing is filtered
		insGrid.classList.toggle('is-filtered', cat !== 'all' || Boolean(q));
		empty.hidden = shown > 0;
		status.textContent = shown === cards.length ? '' : `${shown} of ${cards.length} articles`;
	};
	chips.forEach((chip) => chip.addEventListener('click', () => {
		cat = chip.dataset.cat;
		chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
		apply();
	}));
	search.addEventListener('input', apply);
}

// Contact: copy buttons beside the email and phone.
document.querySelectorAll('.ct-copy').forEach((btn) => btn.addEventListener('click', async () => {
	const value = btn.closest('li').querySelector('.ct-value').textContent.trim();
	try { await navigator.clipboard.writeText(value); } catch (err) { return; }
	btn.classList.add('is-copied');
	setTimeout(() => btn.classList.remove('is-copied'), 1600);
}));

// Contact: project enquiry in three steps. Each step is checked before moving on; step 3 shows a
// short review of what will be sent. The prototype sends nothing.
const wiz = document.querySelector('.wiz');
if (wiz) {
	const pages = [...wiz.querySelectorAll('.wiz-page')];
	const markers = [...document.querySelectorAll('.wiz-steps li')];
	const bar = document.querySelector('.wiz-bar span');
	const back = wiz.querySelector('.wiz-back');
	const next = wiz.querySelector('.wiz-next');
	const submit = wiz.querySelector('.wiz-submit');
	const scope = wiz.querySelector('#c-scope');
	const counter = wiz.querySelector('.char-count');
	let page = 0;
	const msg = {
		name: 'Please enter your full name.',
		email: 'Please enter a valid email address, like name@company.com.',
		phone: 'Please enter a phone number with at least 10 digits.',
		location: 'Please enter where the project is.',
		scope: 'Please describe the scope in a few lines.',
		service: 'Please choose at least one service.',
	};
	const show = (i) => {
		page = i;
		pages.forEach((p, k) => { p.hidden = k !== i; p.classList.toggle('is-current', k === i); });
		markers.forEach((m, k) => { m.classList.toggle('is-current', k === i); m.classList.toggle('is-done', k < i); });
		bar.style.transform = `scaleX(${((i + 1) / pages.length).toFixed(3)})`;
		back.hidden = i === 0;
		next.hidden = i === pages.length - 1;
		submit.hidden = i !== pages.length - 1;
		if (i === pages.length - 1) review();
	};
	const validate = (p) => {
		let firstBad = null;
		p.querySelectorAll('input[required], textarea[required]').forEach((el) => {
			const bad = !el.checkValidity() || (el.tagName === 'TEXTAREA' && el.value.trim().length < 10);
			el.setAttribute('aria-invalid', String(bad));
			el.closest('.field').querySelector('.field-error').textContent = bad ? msg[el.name] : '';
			if (bad && !firstBad) firstBad = el;
		});
		const group = p.querySelector('[data-group="service"]');
		if (group) {
			const none = !group.querySelector('input:checked');
			group.querySelector('.field-error').textContent = none ? msg.service : '';
			if (none && !firstBad) firstBad = group.querySelector('input');
		}
		if (firstBad) firstBad.focus();
		return !firstBad;
	};
	const review = () => {
		const v = (n) => (wiz.elements[n] && wiz.elements[n].value.trim()) || '—';
		const services = [...wiz.querySelectorAll('input[name="service"]:checked')].map((x) => x.value).join(', ') || '—';
		const type = (wiz.querySelector('input[name="type"]:checked') || {}).value || '—';
		const esc = (t) => t.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
		wiz.querySelector('.wiz-review').innerHTML = `<h3>You are sending</h3><dl>${[
			['Name', v('name')], ['Organisation', v('org')], ['Email', v('email')], ['Phone', v('phone')],
			['Services', services], ['Project type', type], ['Location', v('location')], ['Start', v('start')],
		].map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>`;
	};
	next.addEventListener('click', () => { if (validate(pages[page])) show(page + 1); });
	back.addEventListener('click', () => show(page - 1));
	scope.addEventListener('input', () => { counter.textContent = `${scope.value.length} / 1500`; });
	wiz.addEventListener('submit', (e) => {
		e.preventDefault();
		if (!validate(pages[page])) return;
		wiz.hidden = true;
		document.querySelector('.wiz-steps').hidden = true;
		document.querySelector('.wiz-bar').hidden = true;
		const done = document.querySelector('.wiz-done');
		done.hidden = false;
		done.focus();
	});
	show(0);
}


/* ---------- Expertise: the row under the pointer, in focus or at mid-screen drives the preview panel ---------- */
(function () {
	const index = document.querySelector('.ex-index');
	if (!index) return;
	const rows = [...index.querySelectorAll('.ex-row')];
	const imgs = [...index.querySelectorAll('.ex-media img')];
	const slides = [...index.querySelectorAll('.ex-slide')];
	const ruler = index.querySelector('.ex-ruler');
	const note = index.querySelector('.ex-ruler-n');
	const counts = rows.map((r) => r.querySelector('.ex-row-count b').textContent);
	let current = -1, hovering = false;
	function setActive(i) {
		if (i === current) return;
		current = i;
		rows.forEach((r) => r.classList.toggle('is-active', +r.dataset.svc === i));
		imgs.forEach((m) => m.classList.toggle('is-on', +m.dataset.svc === i));
		slides.forEach((s) => s.classList.toggle('is-on', +s.dataset.svc === i));
		if (ruler) ruler.dataset.active = i;
		if (note) note.textContent = counts[rows.findIndex((r) => +r.dataset.svc === i)];
	}
	rows.forEach((r) => {
		r.addEventListener('pointerenter', () => { hovering = true; setActive(+r.dataset.svc); });
		r.addEventListener('pointerleave', () => { hovering = false; });
		r.addEventListener('focus', () => setActive(+r.dataset.svc));
	});
	if ('IntersectionObserver' in window) {
		const io = new IntersectionObserver((entries) => {
			if (hovering) return;
			entries.forEach((e) => { if (e.isIntersecting) setActive(+e.target.dataset.svc); });
		}, { rootMargin: '-40% 0px -55% 0px' });
		rows.forEach((r) => io.observe(r));
	}
	setActive(0);
})();

/* ---------- Expertise: scope matrix, dots pop in once, and the hovered column lights up ---------- */
(function () {
	const table = document.querySelector('.ex-matrix');
	if (!table) return;
	table.addEventListener('pointerover', (e) => {
		const cell = e.target instanceof Element && e.target.closest('[data-col]');
		if (cell) table.dataset.col = cell.dataset.col; else delete table.dataset.col;
	});
	table.addEventListener('pointerleave', () => { delete table.dataset.col; });
	if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	table.classList.add('is-armed');
	const io = new IntersectionObserver((entries) => {
		if (entries[0].isIntersecting) { table.classList.add('is-live'); io.disconnect(); }
	}, { threshold: 0.3 });
	io.observe(table);
})();

/* ---------- Privacy notice and articles: on-this-page highlight and reading progress ---------- */
(function () {
	const navs = [...document.querySelectorAll('[data-spy]')];
	const progress = document.querySelector('.ar-progress span');
	if (!navs.length && !progress) return;
	const links = navs.flatMap((n) => [...n.querySelectorAll('a[href^="#"]')]);
	const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
	const bar = document.querySelector('.pv-toc-bar span');
	const body = document.querySelector('.pv-body, .ar-body');
	let ticking = false;
	function update() {
		ticking = false;
		const line = innerHeight * 0.3;
		let cur = null;
		targets.forEach((t) => { if (t.getBoundingClientRect().top <= line) cur = t; });
		if (!cur && targets.length) cur = targets[0];
		links.forEach((a) => a.classList.toggle('is-current', cur && a.getAttribute('href') === '#' + cur.id));
		targets.forEach((t) => t.classList.toggle('is-current', t === cur));
		if (body) {
			const r = body.getBoundingClientRect();
			const p = Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height));
			if (bar) bar.style.setProperty('--p', p.toFixed(3));
			if (progress) progress.style.setProperty('--p', p.toFixed(3));
		}
	}
	addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
	addEventListener('resize', update);
	update();
})();

/* ---------- Article: borehole log, pick a layer by button or on the drawing ---------- */
(function () {
	const fig = document.querySelector('.bh-fig');
	if (!fig) return;
	const svg = fig.querySelector('.bh-svg');
	const btns = [...fig.querySelectorAll('.bh-btn')];
	const layers = [...fig.querySelectorAll('.bh-layer')];
	const descs = [...fig.querySelectorAll('.bh-desc')];
	function pick(key) {
		svg.classList.add('has-pick');
		btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === key)));
		layers.forEach((l) => l.classList.toggle('is-on', l.dataset.layer === key));
		descs.forEach((d) => d.classList.toggle('is-on', d.dataset.layer === key));
	}
	btns.forEach((b) => {
		b.addEventListener('click', () => pick(b.dataset.layer));
		b.addEventListener('pointerenter', () => pick(b.dataset.layer));
	});
	layers.forEach((l) => {
		l.addEventListener('pointerenter', () => pick(l.dataset.layer));
		l.addEventListener('click', () => pick(l.dataset.layer));
	});
	pick(btns[0].dataset.layer);
	if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	fig.classList.add('is-armed');
	const io = new IntersectionObserver((entries) => {
		if (entries[0].isIntersecting) { fig.classList.add('is-live'); io.disconnect(); }
	}, { threshold: 0.35 });
	io.observe(fig);
})();

/* ---------- Article: report checklist count ---------- */
(function () {
	const box = document.querySelector('.ar-check');
	if (!box) return;
	const inputs = [...box.querySelectorAll('input[type="checkbox"]')];
	const count = box.querySelector('.ar-check-count');
	const bar = box.querySelector('.ar-check-bar span');
	function update() {
		const n = inputs.filter((i) => i.checked).length;
		count.innerHTML = n === inputs.length ? '<b>All ' + n + '</b> covered' : '<b>' + n + '</b> of ' + inputs.length;
		bar.style.setProperty('--p', n / inputs.length);
	}
	inputs.forEach((i) => i.addEventListener('change', update));
	update();
})();

/* ---------- Article: copy link ---------- */
(function () {
	const btn = document.querySelector('[data-copy-url]');
	if (!btn) return;
	const label = btn.querySelector('span');
	btn.addEventListener('click', async () => {
		try { await navigator.clipboard.writeText(location.href.split('#')[0]); label.textContent = 'Link copied'; }
		catch (err) { label.textContent = 'Copy failed'; }
		btn.classList.add('is-copied');
		setTimeout(() => { btn.classList.remove('is-copied'); label.textContent = 'Copy link'; }, 2000);
	});
})();

/* ---------- Article figures: buttons switch the figure's data-state; CSS shows the matching [data-when] ---------- */
(function () {
	const figs = document.querySelectorAll('.fig-ix[data-state]');
	if (!figs.length) return;
	figs.forEach((fig) => {
		const btns = [...fig.querySelectorAll('.fig-ix-btn[data-set]')];
		btns.forEach((b) => b.addEventListener('click', () => {
			fig.dataset.state = b.dataset.set;
			btns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
		}));
	});
})();

/* ---------- Article: UPV slider, velocity to quality band ---------- */
(function () {
	const range = document.querySelector('.upv-range');
	if (!range) return;
	const fig = range.closest('.upv-fig');
	const out = fig.querySelector('.upv-out b');
	const say = fig.querySelector('.upv-say');
	const bands = [...fig.querySelectorAll('.upv-scale li')];
	const text = {
		excellent: '<b>Excellent.</b> Dense, uniform concrete with no significant voids or cracking along the path.',
		good: '<b>Good.</b> Generally sound concrete. Compare with neighbouring readings: a local drop is more telling than any single value.',
		medium: '<b>Medium.</b> Some lack of uniformity, porosity or cracking may be present. Investigate further, typically with cores.',
		doubtful: '<b>Doubtful.</b> Likely voids, honeycombing or cracking along the path. Confirm with cores and closer testing.'
	};
	function update() {
		const v = parseFloat(range.value);
		const band = v > 4.5 ? 'excellent' : v >= 3.5 ? 'good' : v >= 3.0 ? 'medium' : 'doubtful';
		out.textContent = v.toFixed(2).replace(/0$/, '');
		range.setAttribute('aria-valuetext', v.toFixed(2) + ' kilometres per second, ' + band);
		bands.forEach((li) => li.classList.toggle('is-on', li.dataset.band === band));
		if (say.dataset.band !== band) { say.dataset.band = band; say.innerHTML = text[band]; }
	}
	range.addEventListener('input', update);
	update();
})();
