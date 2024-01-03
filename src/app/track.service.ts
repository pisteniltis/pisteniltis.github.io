import { Injectable } from '@angular/core';

import tracksData from '../assets/turrach/tracks.json';
import coordsData from '../assets/turrach/coords.json';
import planCoordsData from '../assets/turrach/planCoords.json';

export const red = "#ED1C24";
export const black = "#000000";
export const blue = "#00A2E8";
export const yellow = "#FFCC00";
export const orange = "#FFA500";
export const green = "#22B14C";

export interface Coords {
  lat: number; 
  lng: number;
  ele?: number;
  time?: Date | string
  timeDiff?: number
  timeDiffOld?: number
}
export interface Link {
  nr: number | string;
  offset?: number;
  moving?: boolean; 
  position: string;
  showAs?: number | string;
}
export interface Navigation {
  timeDiff: number;
  showAs?: number | string;
  links?: Link[];
  speedUp?: number;
  timeDiffRT?: number;
  nextTimeDiff?: number;
}
export interface Track {
  nr: number | string;
  title: string;
  subtitle?: string;
  image: string;
  rotation?: number;
  video?: string;
  video2D?: string;
  videoBack?: string;
  time?: Date | string;
  color?: string;
  dashed?: boolean;
  coordsFile?: string;
  coords?: Coords[];
  coordsTrackOnly?: Coords[];
  planCoords?: Coords[];
  planCoordsTrackOnly?: Coords[];
  navigation? : Navigation[],
  labelPosition?: {lat: number, lng: number};
  polyline?: google.maps.Polyline;
  labelMarker?: google.maps.Marker;
  start?: number;
  end?: number;
  orientation?: number;
  navigate?: number | string;
  disabled?: boolean;
  minEle?: number; maxEle?: number;
}
export interface MapOptions {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  center?: google.maps.LatLngLiteral;
  tileUrl?: string;
  maxTileX?: number;
  maxTileY?: number;
  restriction?: google.maps.MapRestriction;
}

@Injectable({
  providedIn: 'root'
})
export class TrackService {

  tracks: Track[] = [];
  tracksById: {[key: string | number]: Track} = {};
  mapOptions?: MapOptions;
  minEle: number;
  maxEle: number;
  planOptions?: MapOptions;

  constructor() { 
    var minLat = null as number | null; var maxLat = null as number | null;
    var minLng = null as number | null; var maxLng = null as number | null;
    var minEle = null as number | null; var maxEle = null as number | null;
    for (const dt of tracksData.tracks) 
    {
      const t: Track = dt;
      if (t.time) t.time = new Date(t.time as string);
      if (t.color) t.color = t.color == "blue" ? blue : t.color == "red" ? red : t.color == "black" ? black : t.color == "yellow" ? yellow : t.color == "orange" ? orange : t.color == "green" ? green : t.color;
      var diff = 0;
      if (t.navigation)
      {
        this.interpolateMissingData(t.navigation, "timeDiff");
        for (const j in t.navigation) {
          if (t.navigation[j].showAs == t.nr) console.log("unsupported " + t.nr + " show as " + t.nr);
          t.navigation[j].timeDiffRT = t.navigation[j].timeDiff + diff;
          if (+j + 1 < t.navigation.length)
          {
            t.navigation[j].nextTimeDiff = t.navigation[+j + 1].timeDiff;
            if (t.navigation[j].speedUp) diff = diff + (t.navigation[j].nextTimeDiff! - t.navigation[j].timeDiff) * (t.navigation[j].speedUp! - 1);
          }
        }
      }
      if ((coordsData as any)[t.nr])
      {
        t.coords = (coordsData as any)[t.nr];
      }
      if (t.coords)
      {
        for (const j in t.coords) {
          const c = t.coords[j];
          if (c.time)
          {
            c.time = new Date(c.time as string);
            if (!t.time) t.time = c.time;
            c.timeDiff = ((c.time as Date).valueOf() - (t.time as Date).valueOf()) / 1000;
          }
          else if (c.timeDiff == null && +j == 0)
            c.timeDiff = 0
        }
        this.interpolateMissingData(t.coords, "timeDiff");
        this.interpolateMissingData(t.coords, "ele", "timeDiff");
        for (const j in t.coords) {
          const c = t.coords[j];
          if (tracksData.eleOffset) c.ele = c.ele! - tracksData.eleOffset;
          if (minLat == null || minLat > c.lat) minLat = c.lat;
          if (maxLat == null || maxLat < c.lat) maxLat = c.lat;
          if (minLng == null || minLng > c.lng) minLng = c.lng;
          if (maxLng == null || maxLng < c.lng) maxLng = c.lng;
          if (t.minEle == null || t.minEle > c.ele!) t.minEle = c.ele;
          if (t.maxEle == null || t.maxEle < c.ele!) t.maxEle = c.ele;
        }
        if (minEle == null || minEle > t.minEle!) minEle = t.minEle!;
        if (maxEle == null || maxEle < t.maxEle!) maxEle = t.maxEle!;
      }

      const tNavigate = t.navigate ? this.tracksById[t.navigate] : t;
      if (tNavigate.navigation)
        for (const j in tNavigate.navigation) {
          if (+j == 0 && tNavigate.navigation[j].timeDiff != 0 && t.start == null && tNavigate.nr == t.nr) t.start = 0;
          if ((tNavigate.navigation[j].showAs || tNavigate.nr) == t.nr && tNavigate.navigation[j].showAs != tNavigate.nr && t.start == null) t.start = tNavigate.navigation[j].timeDiff;
          if (t.start != null && t.end == null && (tNavigate.navigation[j].showAs || tNavigate.nr) != t.nr) { t.end = tNavigate.navigation[j].timeDiff; break; }
        }
      const startRT = t.start ? this.convertTimeDiffToRT(tNavigate, t.start): null;
      const endRT = t.end ? this.convertTimeDiffToRT(tNavigate, t.end): null;
      t.coordsTrackOnly = [];
      if (tNavigate.coords)
        for (const j in tNavigate.coords)
          if ((startRT == null || startRT < tNavigate.coords[+j+1]?.timeDiff!) && (endRT == null || endRT >= tNavigate.coords[j].timeDiff!)) 
            t.coordsTrackOnly.push(tNavigate.coords[j]);
      if ((planCoordsData as any)[t.nr])
      {
        t.planCoords = (planCoordsData as any)[t.nr];
      }
      if(t.planCoords && t.planCoords.length > 0)
      {
        if (t.planCoords[0].timeDiff == null) t.planCoords[0].timeDiff = 0;
        this.interpolateMissingData(t.planCoords, "timeDiff");
        t.planCoords = this.bspline(t.planCoords)!;
      }
      t.planCoordsTrackOnly = [];
      if (tNavigate.planCoords)
        for (const j in tNavigate.planCoords)
          if ((t.start == null || t.start < tNavigate.planCoords[+j+1]?.timeDiff!) && (t.end == null || t.end >= tNavigate.planCoords[j].timeDiff!)) 
            t.planCoordsTrackOnly.push(tNavigate.planCoords[j]);
      this.tracks.push(t);
      this.tracksById[t.nr] = t;    
    }
    this.minEle = (tracksData as any).minEle || Math.trunc(minEle!);
    this.maxEle = (tracksData as any).maxEle || Math.trunc(maxEle!);
    this.mapOptions = tracksData.mapOptions;
    if (!this.mapOptions!.center) this.mapOptions!.center = this.getCenter({ north: maxLat!, south: minLat!, west: minLng!, east: maxLng! });
    this.planOptions = (tracksData as any).planOptions;
    if (this.planOptions)
    {
      if (!this.planOptions.restriction) 
      {
        const scale = 1 << (this.planOptions.maxZoom - 1);
        this.planOptions.restriction = { latLngBounds: {east: 180 * (this.planOptions.maxTileX! + 1) / scale, west: 0, south: -180 * (this.planOptions.maxTileY! + 1) / scale, north: 0 } };
      }
      if (!this.planOptions.center) this.planOptions.center = this.getCenter(this.planOptions.restriction!.latLngBounds as google.maps.LatLngBoundsLiteral);
    } 
  }

  private bspline(coords?: Coords[]) {
    if (!coords || coords.length == 0) return null;
    const points = [] as Coords[];
    var i1 = 0; var i2 = 0; var i3 = 0; var i4 = 1;
    while(true) {
      const ax = (-1 * coords[i1].lat       + 3 * coords[i2].lat       - 3 * coords[i3].lat       + 1 * coords[i4].lat      ) / 6;
      const ay = (-1 * coords[i1].lng       + 3 * coords[i2].lng       - 3 * coords[i3].lng       + 1 * coords[i4].lng      ) / 6;
      const at = (-1 * coords[i1].timeDiff! + 3 * coords[i2].timeDiff! - 3 * coords[i3].timeDiff! + 1 * coords[i4].timeDiff!) / 6;
      const bx = ( 3 * coords[i1].lat       - 6 * coords[i2].lat       + 3 * coords[i3].lat                                 ) / 6;
      const by = ( 3 * coords[i1].lng       - 6 * coords[i2].lng       + 3 * coords[i3].lng                                 ) / 6;
      const bt = ( 3 * coords[i1].timeDiff! - 6 * coords[i2].timeDiff! + 3 * coords[i3].timeDiff!                           ) / 6;
      const cx = (-3 * coords[i1].lat                                  + 3 * coords[i3].lat                                 ) / 6;
      const cy = (-3 * coords[i1].lng                                  + 3 * coords[i3].lng                                 ) / 6;
      const ct = (-3 * coords[i1].timeDiff!                            + 3 * coords[i3].timeDiff!                           ) / 6;
      const dx = ( 1 * coords[i1].lat       + 4 * coords[i2].lat       + 1 * coords[i3].lat                                 ) / 6;
      const dy = ( 1 * coords[i1].lng       + 4 * coords[i2].lng       + 1 * coords[i3].lng                                 ) / 6;
      const dt = ( 1 * coords[i1].timeDiff! + 4 * coords[i2].timeDiff! + 1 * coords[i3].timeDiff!                           ) / 6;
      for (var t = i3 == 0 ? 0 : 0.2; t <= 1; t += 0.2)
        points.push({
          lat: ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + dx, 
          lng: ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + dy,
          timeDiff: at * Math.pow(t, 3) + bt * Math.pow(t, 2) + ct * t + dt
        });
      i1 = i2; i2 = i3; i3 = i4; 
      if (i1 == coords.length - 1) break;
      if (i4 < coords.length - 1) i4++;
    }
    return points;
  }

  private interpolateMissingData(data: any[], field: string, interpolateBy?: string)
  {
    var lastValue = null as number|null;
    var lastIndex = null as number|null;
    var firstMissing = null as number|null;
    for (var j = 0; j < data.length; j++) {
      const d = data[j];
      const currentValue = d[field] as number;
      if (currentValue != null)
      {
        const currentIndex = interpolateBy ? d[interpolateBy] : j;
        if (firstMissing != null)
        {
          if (lastValue != null && lastIndex != null)
          {
            for (var k = firstMissing; k < j; k++)
            {
              const index = interpolateBy ? data[k][interpolateBy] : k;
              data[k][field] = lastValue + (currentValue - lastValue) * (index - lastIndex) / (currentIndex - lastIndex);
            }
          }
          firstMissing = null;
        }
        lastValue = currentValue;
        lastIndex = currentIndex;
      }
      else if (!firstMissing)
        firstMissing = j;
    }
  }

  private getCenter(bounds: google.maps.LatLngBoundsLiteral)
  {
    return { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }
  }

  get videos() {
    return this.tracks.filter(t => t.video);
  }

  get randomVideo() {
    return this.videos[Math.random() * this.videos.length | 0];
  }

  public getNavigationByTimeDiff(t: Track, time: number)
  {
    if (t.navigation)
      for (const i in t.navigation)
        if (t.navigation[i].timeDiff > time) return +i == 0 ? undefined : t.navigation[+i - 1];
    return t.navigation?.[t.navigation.length - 1];
  }

  public convertTimeDiffToRT(t: Track, time: number)
  {
    const n = this.getNavigationByTimeDiff(t, time);
    return n ? (n.timeDiffRT! + (time - n.timeDiff) * (n!.speedUp || 1)) : time;
  }

  public getNavigationByTimeDiffRT(t: Track, time: number)
  {
    if (t.navigation)
      for (const i in t.navigation)
        if (t.navigation[i].timeDiffRT! > time) return +i == 0 ? undefined : t.navigation[+i - 1];
    return t.navigation?.[t.navigation.length - 1];
  }
  
  public convertTimeDiffFromRT(t: Track, time: number)
  {
    const n = this.getNavigationByTimeDiffRT(t, time);
    return n ? (n.timeDiff! + (time - n.timeDiffRT!) / (n!.speedUp || 1)) : time;
  }

  public getCoordsByTimeDiff(t: Track, time: number)
  {
    return this.getCoordsByCoordsAndTimeDiff(this.convertTimeDiffToRT(t, time), t.coords);
  }

  public getCoordsByCoordsAndTimeDiff(time: number, coords?: Coords[])
  {
    if (!coords) return undefined;
    for (const i in coords)
    {
      if (coords[i].timeDiff! >= time) 
      {
        if (+i == 0 || coords[i].timeDiff! == time) return coords[i];
        const f = (time - coords[+i - 1].timeDiff!) / (coords[i].timeDiff! - coords[+i - 1].timeDiff!);
        return {
          lat: f * coords[i].lat + (1 - f) * coords[+i - 1].lat,
          lng: f * coords[i].lng + (1 - f) * coords[+i - 1].lng,
          ele: coords[i].ele && coords[+i - 1].ele && f * coords[i].ele! + (1 - f) * coords[+i - 1].ele!,
          timeDiff: time
        };
      }
    }
    return coords[coords.length - 1];
  }

  public getClosestCoords(searchPos: google.maps.LatLngLiteral, coords?: Coords[])
  {
    let minDist, minCoords;
    if (coords)
      for (const c of coords)
      {
          const dist = google.maps.geometry.spherical.computeDistanceBetween(c, searchPos)
          if (minDist == null || minDist > dist)
          {
            minDist = dist;
            minCoords = c;
          }
      }
    return minCoords;
  }
}
