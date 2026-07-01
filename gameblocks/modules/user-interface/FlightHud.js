import { clamp, toFinite } from '../math/ScalarUtils.js';

const STYLE_ID = 'fighter-hud-styles';

function getElement(id) {
	return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function setText(element, value) {
	if (element) element.textContent = String(value ?? '');
}

function padNumber(value, width) {
	return String(Math.abs(Math.round(Number(value) || 0))).padStart(width, '0');
}

function normalizeCompassHeadingDegrees(compassHeadingDegrees = 0) {
	const numericCompassHeading = Number(compassHeadingDegrees);
	if (!Number.isFinite(numericCompassHeading)) return 0;
	return ((numericCompassHeading % 360) + 360) % 360;
}

function cardinalForCompassHeadingDegrees(compassHeadingDegrees = 0) {
	const wrapped = normalizeCompassHeadingDegrees(compassHeadingDegrees);
	if (wrapped >= 337.5 || wrapped < 22.5) return 'N';
	if (wrapped < 67.5) return 'NE';
	if (wrapped < 112.5) return 'E';
	if (wrapped < 157.5) return 'SE';
	if (wrapped < 202.5) return 'S';
	if (wrapped < 247.5) return 'SW';
	if (wrapped < 292.5) return 'W';
	return 'NW';
}

function installStyles() {
	if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;

	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
		#hud.flight-fighter-hud {
			inset: 0;
			width: auto;
			padding: 0;
			color: #7dffb7;
			background: transparent;
			border: 0;
			box-shadow: none;
			backdrop-filter: none;
			pointer-events: none;
			text-shadow: 0 0 8px rgba(75, 255, 170, 0.54);
		}

		.flight-fighter-hud__overlay {
			position: fixed;
			inset: 0;
			z-index: 12;
			overflow: hidden;
			font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.flight-fighter-hud__horizon {
			position: absolute;
			left: 50%;
			top: 50%;
			width: min(72vw, 760px);
			height: min(58vh, 520px);
			transform: translate(-50%, -50%);
			overflow: hidden;
		}

		.flight-fighter-hud__pitch {
			position: absolute;
			left: 50%;
			top: 50%;
			width: 620px;
			height: 880px;
			transform-origin: center center;
			will-change: transform;
		}

		.flight-fighter-hud__pitch-line {
			position: absolute;
			left: 50%;
			width: 210px;
			height: 1px;
			background: rgba(125, 255, 183, 0.72);
			transform: translateX(-50%);
		}

		.flight-fighter-hud__pitch-line.zero {
			width: 330px;
			height: 2px;
			background: rgba(125, 255, 183, 0.92);
		}

		.flight-fighter-hud__pitch-line.negative {
			background: repeating-linear-gradient(
				to right,
				rgba(125, 255, 183, 0.7) 0 18px,
				transparent 18px 28px
			);
		}

		.flight-fighter-hud__pitch-label {
			position: absolute;
			top: -9px;
			font-size: 12px;
			color: rgba(181, 255, 215, 0.86);
		}

		.flight-fighter-hud__pitch-label.left {
			left: -48px;
		}

		.flight-fighter-hud__pitch-label.right {
			right: -48px;
		}

		.flight-fighter-hud__reticle {
			position: absolute;
			left: 50%;
			top: 50%;
			width: 148px;
			height: 148px;
			transform: translate(-50%, -50%);
			border: 2px solid rgba(125, 255, 183, 0.9);
			border-radius: 50%;
			box-shadow: 0 0 18px rgba(74, 255, 167, 0.2);
		}

		.flight-fighter-hud__reticle::before,
		.flight-fighter-hud__reticle::after {
			content: "";
			position: absolute;
			top: 50%;
			width: 64px;
			height: 2px;
			background: rgba(125, 255, 183, 0.9);
		}

		.flight-fighter-hud__reticle::before {
			right: 100%;
			margin-right: 18px;
		}

		.flight-fighter-hud__reticle::after {
			left: 100%;
			margin-left: 18px;
		}

		.flight-fighter-hud__waterline {
			position: absolute;
			left: 50%;
			top: 50%;
			width: 270px;
			height: 38px;
			transform: translate(-50%, -50%);
		}

		.flight-fighter-hud__waterline::before,
		.flight-fighter-hud__waterline::after {
			content: "";
			position: absolute;
			top: 50%;
			width: 88px;
			height: 18px;
			border-top: 2px solid rgba(125, 255, 183, 0.84);
		}

		.flight-fighter-hud__waterline::before {
			left: 0;
			border-left: 2px solid rgba(125, 255, 183, 0.84);
		}

		.flight-fighter-hud__waterline::after {
			right: 0;
			border-right: 2px solid rgba(125, 255, 183, 0.84);
		}

		.flight-fighter-hud__dot {
			position: absolute;
			left: 50%;
			top: 50%;
			width: 7px;
			height: 7px;
			transform: translate(-50%, -50%);
			border-radius: 50%;
			background: rgba(125, 255, 183, 0.95);
		}

		.flight-fighter-hud__boresight {
			position: absolute;
			left: 50%;
			top: calc(50% - 112px);
			width: 76px;
			height: 28px;
			transform: translateX(-50%);
			border-top: 2px solid rgba(125, 255, 183, 0.8);
			border-left: 2px solid rgba(125, 255, 183, 0.8);
			border-right: 2px solid rgba(125, 255, 183, 0.8);
		}

		.flight-fighter-hud__roll-scale {
			position: absolute;
			left: 50%;
			top: calc(50% - min(31vh, 285px));
			width: 360px;
			height: 82px;
			transform: translateX(-50%);
			border-top: 1px solid rgba(125, 255, 183, 0.58);
			border-radius: 50% 50% 0 0;
		}

		.flight-fighter-hud__roll-pointer {
			position: absolute;
			left: 50%;
			top: 18px;
			width: 0;
			height: 0;
			transform: translateX(-50%);
			border-left: 7px solid transparent;
			border-right: 7px solid transparent;
			border-top: 14px solid rgba(125, 255, 183, 0.95);
		}

		.flight-fighter-hud__compass-heading {
			position: absolute;
			left: 50%;
			top: 18px;
			min-width: 230px;
			transform: translateX(-50%);
			text-align: center;
			font-size: 14px;
		}

		.flight-fighter-hud__compass-heading strong {
			display: block;
			font-size: 34px;
			line-height: 1;
			color: #d8ffe8;
		}

		.flight-fighter-hud__data {
			position: absolute;
			top: 19vh;
			display: grid;
			gap: 14px;
			min-width: 156px;
			font-size: 12px;
		}

		.flight-fighter-hud__data.left {
			left: 7vw;
		}

		.flight-fighter-hud__data.right {
			right: 7vw;
			text-align: right;
		}

		.flight-fighter-hud__box {
			padding: 8px 10px;
			background: rgba(0, 18, 10, 0.22);
			border: 1px solid rgba(125, 255, 183, 0.32);
		}

		.flight-fighter-hud__box span {
			display: block;
			color: rgba(183, 255, 217, 0.72);
			font-size: 10px;
		}

		.flight-fighter-hud__box strong {
			display: block;
			margin-top: 2px;
			color: #d8ffe8;
			font-size: 25px;
			line-height: 1.05;
		}

		.flight-fighter-hud__meter {
			width: 100%;
			height: 6px;
			margin-top: 6px;
			background: rgba(125, 255, 183, 0.16);
		}

		.flight-fighter-hud__meter-fill {
			width: 0;
			height: 100%;
			background: rgba(125, 255, 183, 0.9);
			box-shadow: 0 0 12px rgba(125, 255, 183, 0.4);
		}

		.flight-fighter-hud__status {
			position: absolute;
			left: 50%;
			bottom: 96px;
			width: min(76vw, 740px);
			transform: translateX(-50%);
			display: flex;
			justify-content: space-between;
			gap: 18px;
			font-size: 12px;
			color: rgba(216, 255, 232, 0.86);
		}

		.flight-fighter-hud__warning {
			position: absolute;
			left: 50%;
			top: 28%;
			transform: translateX(-50%);
			display: none;
			padding: 9px 18px;
			color: #ffecec;
			background: rgba(157, 10, 10, 0.78);
			border: 1px solid rgba(255, 155, 155, 0.68);
			font-size: 19px;
			animation: fighterHudPulse 0.72s ease-in-out infinite;
		}

		.flight-fighter-hud__warning.active {
			display: block;
		}

		@keyframes fighterHudPulse {
			0%, 100% { opacity: 0.62; }
			50% { opacity: 1; }
		}

		@media (max-width: 760px) {
			.flight-fighter-hud__data {
				top: auto;
				bottom: 122px;
				min-width: 126px;
				font-size: 10px;
			}

			.flight-fighter-hud__data.left {
				left: 12px;
			}

			.flight-fighter-hud__data.right {
				right: 12px;
			}

			.flight-fighter-hud__box strong {
				font-size: 19px;
			}

			.flight-fighter-hud__reticle {
				width: 112px;
				height: 112px;
			}

			.flight-fighter-hud__status {
				bottom: 76px;
				width: calc(100vw - 24px);
				gap: 8px;
				flex-wrap: wrap;
				font-size: 10px;
			}
		}
	`;
	document.head.appendChild(style);
}

function createPitchLine(degrees) {
	const line = document.createElement('div');
	line.className = `flight-fighter-hud__pitch-line${degrees === 0 ? ' zero' : ''}${degrees < 0 ? ' negative' : ''}`;
	line.style.top = `${440 - degrees * 7}px`;

	const labelText = String(Math.abs(degrees));
	for (const side of ['left', 'right']) {
		const label = document.createElement('span');
		label.className = `flight-fighter-hud__pitch-label ${side}`;
		label.textContent = labelText;
		line.appendChild(label);
	}

	return line;
}

export class FlightHud {
	constructor(root = getElement('hud')) {
		this.root = root;
		if (!this.root) {
			throw new Error('FlightHud: #hud root is required');
		}

		installStyles();
		this.root.classList.add('flight-fighter-hud');

		this.state = {
			pullUpWarning: false,
		};

		this.overlay = document.createElement('div');
		this.overlay.className = 'flight-fighter-hud__overlay';
		this.overlay.innerHTML = `
			<div class="flight-fighter-hud__compass-heading">
				<span>HDG</span>
				<strong data-hud="compassHeading">000</strong>
				<span data-hud="cardinal">N</span>
			</div>

			<div class="flight-fighter-hud__roll-scale">
				<div class="flight-fighter-hud__roll-pointer"></div>
			</div>

			<div class="flight-fighter-hud__horizon">
				<div class="flight-fighter-hud__pitch" data-hud="pitchTape"></div>
				<div class="flight-fighter-hud__boresight"></div>
				<div class="flight-fighter-hud__reticle">
					<div class="flight-fighter-hud__dot"></div>
				</div>
				<div class="flight-fighter-hud__waterline"></div>
			</div>

			<div class="flight-fighter-hud__data left">
				<div class="flight-fighter-hud__box">
					<span>SPD</span>
					<strong data-hud="speed">000</strong>
				</div>
				<div class="flight-fighter-hud__box">
					<span>THR</span>
					<strong data-hud="throttle">000%</strong>
					<div class="flight-fighter-hud__meter"><div class="flight-fighter-hud__meter-fill" data-hud="throttleFill"></div></div>
				</div>
				<div class="flight-fighter-hud__box">
					<span>AOA / ROLL</span>
					<strong data-hud="attitude">+0 / +0</strong>
				</div>
			</div>

			<div class="flight-fighter-hud__data right">
				<div class="flight-fighter-hud__box">
					<span>ALT</span>
					<strong data-hud="altitude">000</strong>
				</div>
				<div class="flight-fighter-hud__box">
					<span>AGL</span>
					<strong data-hud="agl">000</strong>
				</div>
				<div class="flight-fighter-hud__box">
					<span>WPN</span>
					<strong data-hud="weapon">--</strong>
				</div>
			</div>

			<div class="flight-fighter-hud__status">
				<span data-hud="region">Hold Pattern</span>
				<span data-hud="wave">FREE</span>
				<span data-hud="lock">LOCK NONE</span>
				<span data-hud="score">score 0</span>
				<span data-hud="time">00:00.0</span>
			</div>

			<div class="flight-fighter-hud__warning" data-hud="warning">PULL UP</div>
		`;

		this.root.appendChild(this.overlay);
		this.pitchTape = this.overlay.querySelector('[data-hud="pitchTape"]');
		for (let degrees = -60; degrees <= 60; degrees += 10) {
			this.pitchTape.appendChild(createPitchLine(degrees));
		}

		this.elements = Object.fromEntries(
			Array.from(this.overlay.querySelectorAll('[data-hud]')).map((element) => [
				element.dataset.hud,
				element,
			])
		);
	}

	setShowHorizonLines(show) {
		this.pitchTape.style.display = show ? 'block' : 'none';
	}

	setPullUpWarning(shouldShow) {
		this.state.pullUpWarning = Boolean(shouldShow);
		this.elements.warning.classList.toggle('active', this.state.pullUpWarning);
	}

	// HUD presentation angles are degrees; simulation angles stay radians.
	renderDashboard({
		regionName = 'Hold Pattern',
		speed = 0,
		altitude = 0,
		agl = 0,
		waveLabel = 'FREE',
		waveDetail = '',
		compassHeadingDegrees = 0,
		compassHeadingText = '',
		timeText = '',
		scoreText = '',
		throttle = 0,
		pitchDegrees = 0,
		rollDegrees = 0,
		weaponLabel = '--',
		lockStatus = 'NONE',
		gunHeat = 0,
		pullUpWarning = null,
	}) {
		const safeCompassHeadingDegrees = normalizeCompassHeadingDegrees(
			Number.isFinite(compassHeadingDegrees)
				? compassHeadingDegrees
				: Number.parseFloat(compassHeadingText)
		);
		const safePitch = ((toFinite(pitchDegrees, 0) % 360) + 360) % 360;
		const safeRoll = toFinite(rollDegrees, 0);
		const throttleRatio = clamp(toFinite(throttle, 0), 0, 1);
		const heatPercent = Math.round(clamp(toFinite(gunHeat, 0), 0, 1) * 100);

		const translatePitch = safePitch < 180 ? safePitch : safePitch - 360;

		setText(this.elements.compassHeading, padNumber(safeCompassHeadingDegrees, 3));
		setText(this.elements.cardinal, cardinalForCompassHeadingDegrees(safeCompassHeadingDegrees));
		setText(this.elements.speed, padNumber(speed, 3));
		setText(this.elements.altitude, padNumber(altitude, 4));
		setText(this.elements.agl, padNumber(agl, 3));
		setText(this.elements.throttle, `${Math.round(throttleRatio * 100).toString().padStart(3, '0')}%`);
		setText(this.elements.attitude, `${safePitch >= 0 ? '+' : ''}${safePitch.toFixed(1)} / ${safeRoll >= 0 ? '+' : ''}${safeRoll.toFixed(1)}`);
		setText(this.elements.weapon, weaponLabel);
		setText(this.elements.region, regionName);
		setText(this.elements.wave, waveDetail ? `${waveLabel} ${waveDetail}` : waveLabel);
		setText(this.elements.lock, `LOCK ${lockStatus}  HEAT ${heatPercent}%`);
		setText(this.elements.score, scoreText);
		setText(this.elements.time, timeText);

		this.elements.throttleFill.style.width = `${Math.round(throttleRatio * 100)}%`;
		this.pitchTape.style.transform = `translate(-50%, -50%) rotate(${-safeRoll}deg) translateY(${translatePitch * 7}px)`;

		if (pullUpWarning !== null) {
			this.setPullUpWarning(pullUpWarning);
		}
	}

	dispose() {
		this.overlay.remove();
		this.root.classList.remove('flight-fighter-hud');
	}
}
