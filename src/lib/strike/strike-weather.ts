import {
  Scene,
  Vector3,
  Color3,
  Color4,
  StandardMaterial,
  AbstractMesh,
  Camera,
  Observer,
  Mesh,
  MeshBuilder,
  DynamicTexture,
  ParticleSystem,
  Particle
} from '@babylonjs/core';

export type WeatherType = 'normal' | 'rain' | 'snow';

export class StrikeWeatherManager {
  private scene: Scene;
  private camera: Camera;
  public currentWeather: WeatherType = 'normal';
  private particleSystem: ParticleSystem | null = null;
  private emitterMesh: Mesh | null = null;
  private renderObserver: Observer<Scene> | null = null;
  private weatherTimer: any = null;
  private onWeatherChange?: (weather: WeatherType) => void;

  // Procedural particle textures (soft radial sprites / streaks instead of cubes)
  private sakuraTex: DynamicTexture;
  private rainTex: DynamicTexture;
  private snowTex: DynamicTexture;
  private puddleMat: StandardMaterial;
  private puddles: AbstractMesh[] = [];

  constructor(scene: Scene, camera: Camera, onWeatherChange?: (weather: WeatherType) => void) {
    this.scene = scene;
    this.camera = camera;
    this.onWeatherChange = onWeatherChange;

    // Sakura petal sprite: soft pink ellipse
    this.sakuraTex = new DynamicTexture('weatherSakuraTex', 64, scene, false);
    this.paintTexture(this.sakuraTex, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const g = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255, 190, 215, 1)');
      g.addColorStop(0.6, 'rgba(242, 150, 190, 0.9)');
      g.addColorStop(1, 'rgba(242, 150, 190, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(w / 2, h / 2, w * 0.42, h * 0.26, 0, 0, Math.PI * 2);
      c.fill();
    });

    // Rain streak sprite: thin vertical highlight, fading top & bottom
    this.rainTex = new DynamicTexture('weatherRainTex', { width: 32, height: 128 }, scene, false);
    this.paintTexture(this.rainTex, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(160, 190, 235, 0)');
      g.addColorStop(0.45, 'rgba(200, 222, 250, 0.85)');
      g.addColorStop(0.6, 'rgba(220, 238, 255, 0.95)');
      g.addColorStop(1, 'rgba(160, 190, 235, 0)');
      c.fillStyle = g;
      c.fillRect(w / 2 - w * 0.14, 0, w * 0.28, h);
    });

    // Snowflake sprite: fluffy radial white dot
    this.snowTex = new DynamicTexture('weatherSnowTex', 64, scene, false);
    this.paintTexture(this.snowTex, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const g = c.createRadialGradient(w / 2, h / 2, 0.5, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.45, 'rgba(255, 255, 255, 0.95)');
      g.addColorStop(0.8, 'rgba(255, 255, 255, 0.45)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });

    // Rain puddle Material (dark wet tile with a sheen)
    this.puddleMat = new StandardMaterial('weatherPuddleMat', scene);
    this.puddleMat.diffuseColor = new Color3(0.11, 0.15, 0.21);
    this.puddleMat.specularColor = new Color3(0.55, 0.65, 0.75);
    this.puddleMat.specularPower = 90;
    this.puddleMat.emissiveColor = new Color3(0.03, 0.045, 0.07);
    this.puddleMat.alpha = 0.42;

    // Synchronize initial weather based on 15-minute epoch cycle
    this.updateWeatherFromEpoch();

    // Check epoch every 10 seconds to transition smoothly when 15-minute boundary occurs
    this.weatherTimer = setInterval(() => {
      this.updateWeatherFromEpoch();
    }, 10_000);

    // Frame update hook: keep the invisible emitter glued to the camera
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.emitterMesh && this.camera.position) {
        this.emitterMesh.position.copyFrom(this.camera.position);
      }
    });
  }

  private paintTexture(tex: DynamicTexture, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const size = tex.getSize();
    draw(ctx, size.width, size.height);
    tex.update();
  }

  private updateWeatherFromEpoch() {
    const cycleIndex = Math.floor(Date.now() / (15 * 60 * 1000)) % 3;
    const types: WeatherType[] = ['normal', 'rain', 'snow'];
    const targetWeather = types[cycleIndex];
    if (targetWeather !== this.currentWeather) {
      this.setWeather(targetWeather);
    } else if (!this.particleSystem) {
      this.buildParticles(targetWeather);
    }
  }

  public setWeather(weather: WeatherType) {
    if (this.currentWeather === weather && this.particleSystem) return;
    this.currentWeather = weather;
    this.buildParticles(weather);
    this.onWeatherChange?.(weather);
  }

  private clearParticles() {
    if (this.particleSystem) {
      this.particleSystem.dispose();
      this.particleSystem = null;
    }
    if (this.emitterMesh) {
      this.emitterMesh.dispose();
      this.emitterMesh = null;
    }
    for (const pd of this.puddles) {
      pd.dispose();
    }
    this.puddles = [];
  }

  /** Flat wet patches that appear across the courtyard while it rains */
  private buildPuddles() {
    for (let i = 0; i < 16; i++) {
      const radius = 1.3 + Math.random() * 2.2;
      const disc = MeshBuilder.CreateDisc(`puddle_${i}`, { radius, tessellation: 18 }, this.scene);
      disc.position = new Vector3((Math.random() - 0.5) * 42, 0.02, (Math.random() - 0.5) * 42);
      disc.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI * 2);
      disc.material = this.puddleMat;
      disc.isPickable = false;
      disc.checkCollisions = false;
      this.puddles.push(disc);
    }
  }

  private buildParticles(weather: WeatherType) {
    this.clearParticles();

    if (weather === 'rain') {
      // Wet ground puddles (only while it is raining)
      this.buildPuddles();
    }

    // Invisible mesh emitter that follows the camera every frame
    const emitter = new Mesh(`${weather}_emitter`, this.scene);
    emitter.position.copyFrom(this.camera.position);
    this.emitterMesh = emitter;

    const ps = new ParticleSystem(`${weather}_particles`, 1500, this.scene);
    ps.emitter = emitter;
    ps.isBillboardBased = true;
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_ALL;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.gravity = new Vector3(0, 0, 0);

    if (weather === 'rain') {
      ps.particleTexture = this.rainTex;
      ps.minLifeTime = 6;
      ps.maxLifeTime = 9;
      ps.emitRate = 240;
      ps.minEmitBox = new Vector3(-17, -0.5, -17);
      ps.maxEmitBox = new Vector3(17, 18, 17);
      ps.direction1 = new Vector3(-0.3, -14, -0.3);
      ps.direction2 = new Vector3(0.3, -20, 0.3);
      ps.minSize = 0.5;
      ps.maxSize = 0.85;
      ps.minInitialRotation = -0.06;
      ps.maxInitialRotation = 0.06;
      ps.minAngularSpeed = 0;
      ps.maxAngularSpeed = 0;
      ps.color1 = new Color4(0.75, 0.87, 1.0, 0.55);
      ps.color2 = new Color4(0.55, 0.7, 0.9, 0.3);
      ps.colorDead = new Color4(0.5, 0.65, 0.85, 0);
      ps.updateFunction = (particles: Particle[]) => {
        this.updateRainParticles(particles);
      };
    } else if (weather === 'snow') {
      ps.particleTexture = this.snowTex;
      ps.minLifeTime = 11;
      ps.maxLifeTime = 14;
      ps.emitRate = 110;
      ps.minEmitBox = new Vector3(-18, -0.5, -18);
      ps.maxEmitBox = new Vector3(18, 20, 18);
      ps.direction1 = new Vector3(-0.4, -1.6, -0.4);
      ps.direction2 = new Vector3(0.4, -3.2, 0.4);
      ps.minSize = 0.16;
      ps.maxSize = 0.34;
      ps.minAngularSpeed = -1.6;
      ps.maxAngularSpeed = 1.6;
      ps.color1 = new Color4(1.0, 1.0, 1.0, 0.95);
      ps.color2 = new Color4(0.86, 0.9, 0.98, 0.75);
      ps.colorDead = new Color4(1.0, 1.0, 1.0, 0);
      ps.updateFunction = (particles: Particle[]) => {
        this.updateFallingParticles(particles, 1.1, 1.7);
      };
    } else {
      // Normal: Gentle falling cherry blossom petals
      ps.particleTexture = this.sakuraTex;
      ps.minLifeTime = 12;
      ps.maxLifeTime = 15;
      ps.emitRate = 80;
      ps.minEmitBox = new Vector3(-19, -0.5, -19);
      ps.maxEmitBox = new Vector3(19, 20, 19);
      ps.direction1 = new Vector3(-0.3, -0.9, -0.3);
      ps.direction2 = new Vector3(0.3, -1.7, 0.3);
      ps.minSize = 0.14;
      ps.maxSize = 0.36;
      ps.minAngularSpeed = -2.2;
      ps.maxAngularSpeed = 2.2;
      ps.color1 = new Color4(1.0, 0.78, 0.87, 0.95);
      ps.color2 = new Color4(0.98, 0.6, 0.76, 0.8);
      ps.colorDead = new Color4(1.0, 0.75, 0.85, 0);
      ps.updateFunction = (particles: Particle[]) => {
        this.updateFallingParticles(particles, 2.1, 1.6);
      };
    }

    ps.start();
    this.particleSystem = ps;
  }

  /** Rain: fast streaks with a tiny wind tilt, recycled above the camera */
  private updateRainParticles(particles: Particle[]) {
    const cam = this.camera.position;
    for (const p of particles) {
      p.direction.x += (Math.random() - 0.5) * 0.04;
      p.direction.z += (Math.random() - 0.5) * 0.04;
      if (p.position.y < cam.y - 4) {
        p.position.y = cam.y + 14 + Math.random() * 4;
        p.position.x = cam.x + (Math.random() - 0.5) * 34;
        p.position.z = cam.z + (Math.random() - 0.5) * 34;
      }
      this.wrapHorizontal(p, cam);
    }
  }

  /** Snow & petals: gentle sinusoidal sway while drifting down */
  private updateFallingParticles(particles: Particle[], swayFreq: number, swayAmp: number) {
    const cam = this.camera.position;
    const nowSec = performance.now() / 1000;
    for (const p of particles) {
      let phase = p.metadata as number | undefined;
      if (phase === undefined) {
        phase = Math.random() * Math.PI * 2;
        p.metadata = phase;
      }
      p.direction.x += Math.sin(nowSec * swayFreq + phase) * swayAmp * this.scene.getEngine().getDeltaTime() / 1000;
      p.direction.z += Math.cos(nowSec * (swayFreq * 0.8) + phase) * swayAmp * this.scene.getEngine().getDeltaTime() / 1000;
      if (p.position.y < cam.y - 3.5) {
        p.position.y = cam.y + 13 + p.metadata * 5;
        p.position.x = cam.x + (Math.random() - 0.5) * 34;
        p.position.z = cam.z + (Math.random() - 0.5) * 34;
      }
      this.wrapHorizontal(p, cam);
    }
  }

  private wrapHorizontal(p: Particle, cam: Vector3) {
    const dx = p.position.x - cam.x;
    const dz = p.position.z - cam.z;
    if (Math.abs(dx) > 21) p.position.x = cam.x - Math.sign(dx) * 19;
    if (Math.abs(dz) > 21) p.position.z = cam.z - Math.sign(dz) * 19;
  }

  public dispose() {
    if (this.weatherTimer) {
      clearInterval(this.weatherTimer);
      this.weatherTimer = null;
    }
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
    this.clearParticles();
    this.sakuraTex.dispose();
    this.rainTex.dispose();
    this.snowTex.dispose();
    this.puddleMat.dispose();
  }
}