import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  StandardMaterial,
  AbstractMesh,
  Camera,
  Observer
} from '@babylonjs/core';

export type WeatherType = 'normal' | 'rain' | 'snow';

interface WeatherParticle {
  mesh: AbstractMesh;
  baseSpeed: number;
  swayFreq: number;
  swayAmp: number;
  phase: number;
}

export class StrikeWeatherManager {
  private scene: Scene;
  private camera: Camera;
  public currentWeather: WeatherType = 'normal';
  private particles: WeatherParticle[] = [];
  private renderObserver: Observer<Scene> | null = null;
  private weatherTimer: any = null;
  private onWeatherChange?: (weather: WeatherType) => void;

  // Materials for each weather type
  private sakuraMat: StandardMaterial;
  private rainMat: StandardMaterial;
  private snowMat: StandardMaterial;

  constructor(scene: Scene, camera: Camera, onWeatherChange?: (weather: WeatherType) => void) {
    this.scene = scene;
    this.camera = camera;
    this.onWeatherChange = onWeatherChange;

    // Sakura Petal Material (Translucent soft pink)
    this.sakuraMat = new StandardMaterial('weatherSakuraMat', scene);
    this.sakuraMat.diffuseColor = new Color3(1.0, 0.65, 0.8);
    this.sakuraMat.emissiveColor = new Color3(0.6, 0.25, 0.4);
    this.sakuraMat.alpha = 0.85;

    // Raindrop Streak Material (Translucent sky cyan)
    this.rainMat = new StandardMaterial('weatherRainMat', scene);
    this.rainMat.diffuseColor = new Color3(0.7, 0.85, 1.0);
    this.rainMat.emissiveColor = new Color3(0.3, 0.5, 0.8);
    this.rainMat.alpha = 0.65;

    // Snowflake Material (Fluffy white)
    this.snowMat = new StandardMaterial('weatherSnowMat', scene);
    this.snowMat.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.snowMat.emissiveColor = new Color3(0.8, 0.85, 0.95);
    this.snowMat.alpha = 0.9;

    // Synchronize initial weather based on 15-minute epoch cycle
    this.updateWeatherFromEpoch();

    // Check epoch every 10 seconds to transition smoothly when 15-minute boundary occurs
    this.weatherTimer = setInterval(() => {
      this.updateWeatherFromEpoch();
    }, 10_000);

    // Frame update hook
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.updateParticles();
    });
  }

  private updateWeatherFromEpoch() {
    const cycleIndex = Math.floor(Date.now() / (15 * 60 * 1000)) % 3;
    const types: WeatherType[] = ['normal', 'rain', 'snow'];
    const targetWeather = types[cycleIndex];
    if (targetWeather !== this.currentWeather) {
      this.setWeather(targetWeather);
    } else if (this.particles.length === 0) {
      this.buildParticles(targetWeather);
    }
  }

  public setWeather(weather: WeatherType) {
    if (this.currentWeather === weather && this.particles.length > 0) return;
    this.currentWeather = weather;
    this.buildParticles(weather);
    this.onWeatherChange?.(weather);
  }

  private clearParticles() {
    for (const p of this.particles) {
      p.mesh.dispose();
    }
    this.particles = [];
  }

  private buildParticles(weather: WeatherType) {
    this.clearParticles();

    const camPos = this.camera.position;
    const count = weather === 'rain' ? 220 : weather === 'snow' ? 160 : 70;

    for (let i = 0; i < count; i++) {
      let mesh: AbstractMesh;
      let baseSpeed = 1.2;
      let swayFreq = 1.0;
      let swayAmp = 0.5;

      if (weather === 'rain') {
        // High-velocity translucent rain streak
        mesh = MeshBuilder.CreateBox(`rain_${i}`, { width: 0.035, height: 0.75, depth: 0.035 }, this.scene);
        mesh.material = this.rainMat;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.rotation.z = -0.05; // slight wind tilt
        baseSpeed = 26 + Math.random() * 8;
        swayFreq = 0.2;
        swayAmp = 0.05;
      } else if (weather === 'snow') {
        // Soft fluttering snowflake
        const size = 0.12 + Math.random() * 0.08;
        mesh = MeshBuilder.CreateBox(`snow_${i}`, { width: size, height: size, depth: size }, this.scene);
        mesh.material = this.snowMat;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        baseSpeed = 2.0 + Math.random() * 1.5;
        swayFreq = 1.5 + Math.random() * 1.5;
        swayAmp = 0.8 + Math.random() * 0.6;
      } else {
        // Normal: Gentle falling cherry blossom petal
        mesh = MeshBuilder.CreatePlane(`petal_${i}`, { size: 0.16 }, this.scene);
        mesh.material = this.sakuraMat;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;
        baseSpeed = 1.0 + Math.random() * 0.8;
        swayFreq = 2.0 + Math.random() * 1.0;
        swayAmp = 1.2 + Math.random() * 0.8;
      }

      // Distribute randomly in cylinder around camera
      const offsetX = (Math.random() - 0.5) * 36;
      const offsetZ = (Math.random() - 0.5) * 36;
      const offsetY = -2 + Math.random() * 18;

      mesh.position = new Vector3(camPos.x + offsetX, camPos.y + offsetY, camPos.z + offsetZ);

      this.particles.push({
        mesh,
        baseSpeed,
        swayFreq,
        swayAmp,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  private updateParticles() {
    if (this.particles.length === 0) return;

    const dt = Math.min(0.08, (this.scene.getEngine().getDeltaTime() || 16) / 1000);
    const camPos = this.camera.position;
    const nowSec = performance.now() / 1000;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const pos = p.mesh.position;

      // Downward velocity
      pos.y -= p.baseSpeed * dt;

      // Horizontal sway (snow & petals)
      if (this.currentWeather !== 'rain') {
        pos.x += Math.sin(nowSec * p.swayFreq + p.phase) * p.swayAmp * dt;
        pos.z += Math.cos(nowSec * p.swayFreq * 0.8 + p.phase) * p.swayAmp * dt;
        p.mesh.rotation.y += 1.5 * dt;
      }

      // Recycle if fallen below player ground level or drifted too far
      if (pos.y < camPos.y - 3.5) {
        pos.y = camPos.y + 12 + Math.random() * 5;
        pos.x = camPos.x + (Math.random() - 0.5) * 34;
        pos.z = camPos.z + (Math.random() - 0.5) * 34;
      }

      // Wrap horizontal bounds if player moved quickly
      const dx = pos.x - camPos.x;
      const dz = pos.z - camPos.z;
      if (Math.abs(dx) > 22) pos.x = camPos.x - Math.sign(dx) * 20;
      if (Math.abs(dz) > 22) pos.z = camPos.z - Math.sign(dz) * 20;
    }
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
    this.sakuraMat.dispose();
    this.rainMat.dispose();
    this.snowMat.dispose();
  }
}
