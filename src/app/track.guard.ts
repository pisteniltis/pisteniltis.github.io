import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { TrackService } from './track.service';

@Injectable({
  providedIn: 'root'
})
export class TrackGuard implements CanActivate {
  constructor(private _trackService: TrackService, private _router: Router) {}

  canActivate(next: ActivatedRouteSnapshot) {
    const track = !!next.params['id'] && this._trackService.tracksById[next.params['id']];
    if (track && (track.video || track.coords)) return true;
    if (track && track.navigate) {
      const params: any = {};
      if ((track.start || 0) != (this._trackService.tracksById[track.navigate].start || 0))
        params['t'] = (track.start || 0);
      params['m'] = next.params['m'];
      console.log('navigate to ' + track.navigate + " "  + JSON.stringify(params))
      return this._router.createUrlTree([track.navigate, params]);
    }
    if (next.params['id']) console.log("track " + next.params['id'] + " not found");
    return this._router.createUrlTree([this._trackService.randomVideo.nr]);
  }
}
