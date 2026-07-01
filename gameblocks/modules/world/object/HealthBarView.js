import * as THREE from 'three';
import { clamp01 } from '../../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';

export class HealthBarView {
  constructor({
    upOffset = 3.15,
    width = 2.1,
    height = 0.28,
    fillWidth = 1.86,
    fillHeight = 0.14,
    segmentCount = 8,
    backColor = 0x101010,
    frameColor = 0xf2f2f2,
    healthyColor = 0x7dff8a,
    warningColor = 0xffd86b,
    dangerColor = 0xff6767,
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.upOffset = upOffset;
    this.basis = basis;
    this.fillWidth = fillWidth;
    this.healthyColor = healthyColor;
    this.warningColor = warningColor;
    this.dangerColor = dangerColor;

    this.group = new THREE.Group();
    this.back = this._createSprite(backColor, 0.92);
    this.back.scale.set(width, height, 1);
    this.group.add(this.back);

    this.fill = this._createSprite(healthyColor, 0.95);
    this.fill.center.set(0, 0.5);
    this.fill.position.x = -fillWidth * 0.5;
    this.fill.scale.set(fillWidth, fillHeight, 1);
    this.group.add(this.fill);

    this.frame = this._createSprite(frameColor, 0.12);
    this.frame.scale.set(width + 0.08, height + 0.08, 1);
    this.group.add(this.frame);

    this.segments = [];
    for (let index = 1; index < segmentCount; index += 1) {
      const segment = this._createSprite(0x0f1012, 0.78);
      segment.scale.set(0.03, height - 0.04, 1);
      segment.position.x = -fillWidth * 0.5 + (fillWidth * index) / segmentCount;
      this.group.add(segment);
      this.segments.push(segment);
    }
  }

  _createSprite(color, opacity) {
    return new THREE.Sprite(
      new THREE.SpriteMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
  }

  step({
    position,
    cameraQuaternion,
    current,
    max,
    visible = true
  }) {
    this.group.visible = visible;
    if (!visible) return;

    const ratio = clamp01(current / Math.max(1e-6, max));
    this.group.position.copy(position);
    this.basis.addHeight(this.group.position, this.upOffset);
    this.group.quaternion.copy(cameraQuaternion);
    this.fill.scale.x = Math.max(0.001, this.fillWidth * ratio);
    this.fill.position.x = -this.fillWidth * 0.5;
    this._setFillColor(ratio);
  }

  _setFillColor(ratio) {
    if (ratio > 0.6) {
      this.fill.material.color.setHex(this.healthyColor);
    } else if (ratio > 0.3) {
      this.fill.material.color.setHex(this.warningColor);
    } else {
      this.fill.material.color.setHex(this.dangerColor);
    }
  }
}
