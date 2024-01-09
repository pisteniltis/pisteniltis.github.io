import { AfterViewInit, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { GoogleMap } from '@angular/google-maps';
import { MatSelectChange } from '@angular/material/select';
import { MatSlider } from '@angular/material/slider';
import { ActivatedRoute, Router } from '@angular/router';
import { YouTubePlayer } from '@angular/youtube-player';
import { interval } from 'rxjs';
import { Track, TrackService, Navigation, Link, Coords } from '../track.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';

export const WEIGHT_SELECTED = 3;
export const WEIGHT_CURRENT = 2;
export const WEIGHT = 1;

export enum VideoMode {
  _360 = "360",
  front = "front",
  back = "back",
  pip = "pip"
}

export interface LinkItem {
  nr: number | string;
  route: any[];
  image: string;
  position: string;
  title: string;
  subtitle?: string;
}

@Component({
  selector: 'track-view',
  templateUrl: './track-view.component.html',
  styleUrls: ['./track-view.component.scss']
})

export class TrackViewComponent implements AfterViewInit, OnInit  {

  @ViewChild("youtubePlayer") youtubePlayer!: YouTubePlayer;
  @ViewChild("youtubePlayer2") youtubePlayer2!: YouTubePlayer;
  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  @ViewChild("componentContainer") componentContainer: any;
  @ViewChild("youtubeContainer") youtubeContainer: any;
  @ViewChild("mapContainer") mapContainer: any;
  @ViewChild("eleSlider") eleSlider!: MatSlider;

  // YouTube Controls
  @ViewChild("volumeSlider") volumeSlider?: MatSlider;
  @ViewChild("positionSlider") positionSlider!: MatSlider;

  public Math = Math;

  mapOptions: google.maps.MapOptions = {
    backgroundColor: 'white',
    zoomControl: true,
    mapTypeControl: false,
    scrollwheel: true,
    disableDoubleClickZoom: true,
    fullscreenControl: false,
    streetViewControl: false,
    draggableCursor: "default",
    styles: [
      {
         "featureType": "all", // alles aus, nur Gewünschtes an; nur so möglich Pisten von Google nicht anzuzeigen
         "stylers": [{ "visibility": "off" }]
      },
      {
          "featureType": "administrative", // Grenzen mit Text z.B. Steiermark/Kärnten
          "stylers": [{ "visibility": "on" }]
        },{
          "featureType": "landscape", // Wälder in grün
          "stylers": [{ "visibility": "on" }]
        },{
          "featureType": "road", // Strassen ja aber ohne Bezeichnung ("95" etc. würde sonst wie Pistennummer aussehen)
          "elementType": "geometry",
          "stylers": [{ "visibility": "on" }]
        },{
          "featureType": "transit", // Eisenbahn, egal
          "stylers": [{ "visibility": "on" }]
        },{
          "featureType": "water", // Seen in blau
          "stylers": [{ "visibility": "on" }]
        }
    ]
  };
  planMapType?: google.maps.ImageMapType;
  plan = false;

  currentTrack?: Track;
  showAsTrack?: Track;
  currentNavigation?: Navigation;
  positionMarker?: google.maps.Marker;
  currentTime = 0;
  updatePosition = true;
  currentVideo?: string;
  currentCoords?: Coords;

  autoMode = true;
  videoMode?: VideoMode;

  randomDest?: number | string;

  currentLinksLeft?: LinkItem[];
  currentLinksRight?: LinkItem[];
  allLinks?: LinkItem[];

  public showTitle1 = true;
  public showMinMaxEle = true;
  public portrait = false;

  constructor(private route: ActivatedRoute, private router: Router, public trackService: TrackService, private breakpointObserver: BreakpointObserver, @Inject(DOCUMENT) public document: Document) { }

  ngOnInit(): void {
    this.breakpointObserver.observe(["(min-width: 1250px)"]).subscribe(result => this.showTitle1 = result.matches);
    this.breakpointObserver.observe(["(min-width: 1570px)"]).subscribe(result => this.showMinMaxEle = result.matches);
    this.breakpointObserver.observe(["(max-aspect-ratio: 5/4)"]).subscribe(result => this.portrait = result.matches);
  }

  ngAfterViewInit(): void {

    this.changeMapType(false);

    google.maps.event.addListener(this.googleMap.googleMap!, "click", (data:any) => {
      console.log(JSON.stringify(data.latLng));
    });
    this.route.paramMap.subscribe(params => {
      const track = this.trackService.tracksById[params.get('id')!];
      this.currentTime = params.has('t') ? +params.get('t')! : (track.start || 0);
      var mode = params.get('m') as VideoMode;
      if (mode == null || Object.values(VideoMode).indexOf(mode) < 0) mode = VideoMode.pip;
      if (!this.isVideoModeAvailable(mode, track)) mode = VideoMode.front;
      //console.log("starting" + track.nr + "@" + this.currentTime);
      if (this.currentTrack?.nr != track.nr || this.videoMode != mode)
      {
        if (this.currentTrack?.polyline) this.setWeight(this.currentTrack, WEIGHT);
        this.currentTrack = track;
        if (this.currentTrack.polyline) this.setWeight(this.currentTrack, WEIGHT_CURRENT);
        this.videoMode = mode;
        if (this.youtubePlayer && this.isVideo) this.currentVideo = this.youtubePlayer.videoId = this.videoMode == VideoMode._360 ? this.currentTrack.video : this.videoMode == VideoMode.back ? this.currentTrack.videoBack : this.currentTrack.video2D;
        if (this.youtubePlayer2 && this.isVideo && this.videoMode == VideoMode.pip) this.youtubePlayer2.videoId = this.currentTrack.videoBack;
        const links = (this.getAllLinksFrom(this.currentTime + 10) || []).map(l => l.nr).concat([track.nr]);
        this.randomDest = links[Math.random() * links.length | 0];
        console.log("currentVideo " + this.currentVideo + " randomDest " + this.randomDest + " " + JSON.stringify(links));
      }
      if (this.youtubePlayer && this.isVideo) 
      {
        this.youtubePlayer.seekTo(this.currentTime, true);
        if (YT && YT.PlayerState) this.youtubePlayer.playVideo();
      }
      this.syncPlayer2();
      this.updateVideoPosition(this.currentTime);
    })

    interval(250).subscribe(() => {
      //if (!this.currentTime) return;
      if (this.isVideo)
      {
        if (this.youtubePlayer.getPlayerState() == YT.PlayerState.PLAYING) 
        {
          this.updateVideoPosition(this.youtubePlayer.getCurrentTime());
          if (this.ended) 
          {
            this.youtubePlayer.pauseVideo();
            if (this.youtubePlayer2) this.youtubePlayer2.pauseVideo();
            if (this.autoMode) this.navigateToRandomLink();
          }
        }
      }
      else
      {
        if (this.currentTrack?.navigation && this.currentTime > this.currentTrack.navigation![this.currentTrack.navigation.length - 1].timeDiff)
          this.navigateToRandomLink();
        else
          this.updateVideoPosition(this.currentTime + 0.25);
      }
    })
  }

  public changeMapType(plan: boolean)
  {
    this.plan = plan;
    const options = plan ? this.trackService.planOptions! : this.trackService.mapOptions!;
    if (plan && !this.planMapType) 
    {
      this.planMapType = new google.maps.ImageMapType({
        name: "plan",
        getTileUrl: function(coord, zoom) {
          const scale = 1 << (zoom - 1);
          coord.x -= scale; coord.y -= scale;
          const sizeX = options.maxTileX! >> (20 - zoom);
          const sizeY = options.maxTileY! >> (20 - zoom);
          return (coord.x < 0 || coord.x > sizeX || coord.y < 0 || coord.y > sizeY) ? null :
            options.tileUrl!.replace("{z}", ""+zoom).replace("{x}", ""+coord.x.toString()).replace("{y}", ""+coord.y);
        },
        tileSize: new google.maps.Size(256, 256),
        minZoom: options.minZoom,
        maxZoom: options.maxZoom
      });
      this.googleMap.googleMap?.mapTypes.set("plan", this.planMapType);
    }
    this.mapOptions.maxZoom = options.maxZoom,
    this.mapOptions.minZoom = options.minZoom,
    this.mapOptions.restriction = options.restriction;
    this.googleMap.googleMap?.setOptions(this.mapOptions);
    this.googleMap.googleMap?.setMapTypeId(plan ? "plan" : "hybrid");
    this.googleMap.googleMap?.setZoom(options.zoom);
    this.googleMap.googleMap?.setCenter(options.center!)

    for (var i = this.trackService.tracks.length -1; i >= 0; i--)
    {
      const track = this.trackService.tracks[i];
      const coords = plan ? track.planCoordsTrackOnly : track.coordsTrackOnly;
      if (coords && track.color)
      {
        if (track.polyline) track.polyline.setMap(null);
        track.polyline = new google.maps.Polyline({
          path: coords,
          strokeColor: track.color,
          strokeOpacity: track.dashed ? 0 : 1,
          clickable: !track.disabled,
          map: this.googleMap.googleMap!
        });
        this.setWeight(track, WEIGHT);
        if (!track.disabled) {
          google.maps.event.addListener(track.polyline, "mouseover", () => {this.setWeight(track, WEIGHT_SELECTED);});
          google.maps.event.addListener(track.polyline, "mouseout", () => {this.setWeight(track, track.nr == this.currentTrack?.nr ? WEIGHT_CURRENT : WEIGHT);});
          google.maps.event.addListener(track.polyline, "click", (data:any) => {
            console.log(JSON.stringify(data.latLng));
            this.router.navigate(this.getRouteLatLng(track.navigate || track.nr, data.latLng, plan));
          });
        }
      }
      if (track.labelMarker) track.labelMarker.setMap(null);
      if (track.labelPosition) track.labelMarker = new google.maps.Marker({
        position: track.labelPosition,
        icon: {url: track.image, scaledSize: new google.maps.Size(22, 22), anchor: new google.maps.Point(11, 11)},
        clickable: false,
        map: this.googleMap.googleMap!
      });
      /*
      if (track.navigation)
        for (const n of track.navigation.filter(n => n.links && n.links.length > 0)) 
        {
          const t = n.timeDiff; //(n.timeDiff + n.nextTimeDiff!) / 2;
          const pos = plan ? this.trackService.getCoordsByCoordsAndTimeDiff(t, track.planCoords) : this.trackService.getCoordsByTimeDiff(track, t);
          new google.maps.Marker({
            position: pos,
            clickable: false,
            opacity: 0.5,
            label: ""+track.nr+"->"+n.links![0].nr+"@"+t,
            map: this.googleMap.googleMap!
          });
          for (const l of n.links!)
          {
            const t2 = (l.offset == null ? this.trackService.tracksById[l.nr].start! : l.offset!) + (l.moving ? t : 0);
            const pos2 = plan ? this.trackService.getCoordsByCoordsAndTimeDiff(t2, this.trackService.tracksById[l.nr].planCoords) : this.trackService.getCoordsByTimeDiff(this.trackService.tracksById[l.nr], t2);
            google.maps.event.addListener(new google.maps.Polyline(
            {
              path: [pos!, pos2!],
              strokeColor: "pink",
              map: this.googleMap.googleMap!
            }), "click", () => {console.log(""+track.nr+"->"+l.nr+"@"+t+"->"+t2)});
          }
        }*/
    }
    
    if (this.positionMarker) this.positionMarker.setMap(null);
    this.positionMarker = new google.maps.Marker({
      position: this.currentTrack ? this.trackService.getCoordsByTimeDiff(this.currentTrack!, this.currentTime) : options.center, 
      map: this.googleMap.googleMap!
    })
  }

  public get rotation()
  {
    return (this.youtubePlayer as any)?._player?.playerInfo?.sphericalProperties?.yaw;
  }

  private getDashedLine(weight: number)
  {
    return [ {icon: {
      path: "M 0,-1 0,1",
      strokeOpacity: 1,
      scale: weight + 2,
    }, offset: "0", repeat: "20px"} ];
  }

  private setWeight(track: Track, weight: number)
  {
    track?.polyline?.setOptions(track.dashed ? {icons: this.getDashedLine(weight)} : {strokeWeight: weight * 2});
  }

  public onStateChange(event: YT.OnStateChangeEvent)
  {
    //console.log('stateChange ' + event.data);
    if (event.data == YT.PlayerState.UNSTARTED || event.data == YT.PlayerState.CUED) {
      this.startVideo();
    }
    // (event.data == YT.PlayerState.PLAYING) this.updateVideoPosition(this.youtubePlayer.getCurrentTime());
    if (event.data == YT.PlayerState.ENDED && this.autoMode) {
      this.navigateToRandomLink();
    }
    this.syncPlayer2();
    if (this.volumeSlider) this.volumeSlider.value = this.youtubePlayer.isMuted() ? 0 : this.youtubePlayer.getVolume();
    this.positionSlider.max = this.youtubePlayer.getDuration() - 2;
  }

  public onReady(event: YT.PlayerEvent)
  {
    //console.log('ready');
    this.startVideo();
  }

  private startVideo()
  {
    this.youtubePlayer.seekTo(this.currentTime, true);
    this.youtubePlayer.playVideo();
    this.syncPlayer2();
  }

  private updateVideoPosition(time: number)
  {
    this.currentTime = time;
    this.currentNavigation = this.trackService.getNavigationByTimeDiff(this.currentTrack!, time);
    this.showAsTrack = this.currentNavigation?.showAs ? this.trackService.tracksById[this.currentNavigation!.showAs!] : this.currentTrack;
    this.currentCoords = this.trackService.getCoordsByTimeDiff(this.currentTrack!, time);
    //console.log(time + " " + JSON.stringify(this.currentCoords) + " " + JSON.stringify(this.currentNavigation));
    if (this.currentCoords?.ele && this.eleSlider) this.eleSlider.value = Math.trunc(this.currentCoords.ele);
    if (this.plan) this.currentCoords = this.trackService.getCoordsByCoordsAndTimeDiff(time, this.currentTrack!.planCoords);
    if (this.currentCoords) 
    {
      this.positionMarker?.setPosition(this.currentCoords);
      this.googleMap.googleMap?.setCenter(this.currentCoords);
    }
    if (this.positionSlider && this.updatePosition) this.positionSlider.value = time;
    this.currentLinksLeft = this.getCurrentLinks("left").reverse();
    this.currentLinksRight = this.getCurrentLinks("right");
    this.allLinks = undefined;
  }

  private getLinkItems(links: Link[])
  {
    return links.map(link => { 
      const t = this.trackService.tracksById[link.showAs || link.nr];
      return {
        nr: link.nr,
        route: this.getRouteLatLng(link.nr, this.currentCoords, this.plan),
        image: t.image,
        position: link.position,
        title: t.title,
        subtitle: t.subtitle,
        disabled: t.disabled
      };
    });
  }

  private getRoute(nr: number | string, time?: number, videoMode?: VideoMode)
  {
    const params = {} as any;
    if (time) params.t = time;
    params.m = videoMode || this.route.snapshot.params["m"] || this.videoMode;
    return (['/' + nr] as any[]).concat(params.size == 0 ? [] : [params]);
  }

  private getRouteLatLng(nr: number | string, latLng: google.maps.LatLng | google.maps.LatLngLiteral | undefined, plan: boolean, videoMode?: VideoMode)
  {
    const params = {} as any;
    if (latLng)
    {
      const track = this.trackService.tracksById[nr];
      if (plan)
        params.t = this.trackService.getClosestCoords(latLng, track.planCoordsTrackOnly)?.timeDiff || 0;
      else
        params.t = this.trackService.convertTimeDiffFromRT(track.navigate ? this.trackService.tracksById[track.navigate] : track, 
          this.trackService.getClosestCoords(latLng, track.coordsTrackOnly)?.timeDiff!) || 0;
    }
    params.m = videoMode || this.route.snapshot.params["m"] || this.videoMode;
    return (['/' + nr] as any[]).concat(params.size == 0 ? [] : [params]);
  }

  public getCurrentLinks(position?: string)
  {
   return this.getLinkItems((this.currentNavigation?.links||[]).filter(link => position == null || link.position == position)).filter(link => {
     if (this.autoMode && link.nr == this.randomDest) 
     {
       this.randomDest = undefined;
       this.router.navigate(link.route);
     }
     return true;
   });
  }

  public navigateToRandomLink()
  {
    console.log("navigateToRandomLink");
    const links = this.getCurrentLinks();
    if (links) this.router.navigate(links[Math.random() * links.length | 0].route);
  }

  public getAllLinks()
  {
    if (!this.allLinks) this.allLinks = this.getAllLinksFrom(this.currentTime);
    return this.allLinks;
  }

  public getAllLinksFrom(start?: number)
  {
    const keys: {[key: string | number]: boolean} = {};
    return this.currentTrack?.navigation?.
      filter(n => start == null || n.nextTimeDiff == null || n.nextTimeDiff >= start).
      flatMap(n => this.getLinkItems(n.links || []).filter(l => !l.disabled));
  }

  public onLinkMouseOver(id: string | number)
  {
    const track = this.trackService.tracksById[id];
    this.setWeight(track, WEIGHT_SELECTED);
  }

  public onLinkMouseOut(id: string | number)
  {
    const track = this.trackService.tracksById[id];
    this.setWeight(track, track.nr == this.currentTrack?.nr ? WEIGHT_CURRENT : WEIGHT);
  }

  public get isFullscreen()
  {
    return !!document.fullscreenElement;
  }

  public onChangeFullscreen()
  {
    if (this.isFullscreen)
      document.exitFullscreen();
    else
      this.componentContainer.nativeElement.requestFullscreen();
  }

  /*public onChange360()
  {
    this.router.navigate(this.getRoute(this.currentTrack!.nr, this.currentTime, !this.mode360));
  }*/

  public get isVideo()
  {
    return /*false;//*/ !!this.currentTrack?.video || !!this.currentTrack?.video2D || !!this.currentTrack?.videoBack;
  }

  public get playing()
  {
    return /*true;//*/ this.isVideo && this.youtubePlayer && YT && YT.PlayerState && this.youtubePlayer.getPlayerState() == YT.PlayerState.PLAYING;
  }

  public get ended()
  {
    return this.isVideo && this.youtubePlayer && YT && YT.PlayerState && 
      (this.youtubePlayer.getPlayerState() == YT.PlayerState.ENDED || this.youtubePlayer.getCurrentTime() >= this.youtubePlayer.getDuration() - 2);
  }

  public onPlayPause()
  {
    if (this.playing)
      this.youtubePlayer.pauseVideo();
    else if (!this.ended)
      this.youtubePlayer.playVideo();
    this.syncPlayer2();
  }

  public onChangeVolume()
  {
    if (this.volumeSlider!.value == 0)
      this.youtubePlayer.mute();
    else
    {
      this.youtubePlayer.setVolume(this.volumeSlider!.value);
      this.youtubePlayer.unMute();
    }
  }

  public onMuteButton()
  {
    if (this.volumeSlider!.value != 0)
    {
      this.youtubePlayer.mute();
      this.volumeSlider!.value = 0;
    }
    else
    {
      this.youtubePlayer.unMute();
      this.volumeSlider!.value = this.youtubePlayer.getVolume();
    }
  }

  public formatTime(time?: number)
  {
    if (time == null) return "";
    const minutes = time / 60 >> 0;
    const seconds = time % 60 >> 0;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  public onChangePosition()
  {
    this.updatePosition = true;
    this.youtubePlayer.seekTo(this.positionSlider.value, true);
    this.syncPlayer2();
    this.updateVideoPosition(this.positionSlider.value);
  }

  public onInputPosition()
  {
    this.updatePosition = false;
  }

  public onChangeSpeed(event: MatSelectChange)
  {
    this.youtubePlayer.setPlaybackRate(event.value);
    this.syncPlayer2();
  }

  public get availableVideoModes()
  {
    return Object.values(VideoMode).filter(m => this.isVideoModeAvailable(m));
  }

  public isVideoModeAvailable(mode: VideoMode, track?: Track)
  {
    if (track == null) track = this.currentTrack;
    switch(mode)
    {
      case VideoMode._360: return !!track?.video;
      case VideoMode.front: return !!track?.video2D;
      case VideoMode.back: return !!track?.videoBack;
      case VideoMode.pip: return !!track?.video2D && !!track?.videoBack;
    }
  }

  public getVideoModeIcon(mode: VideoMode)
  {
    switch(mode)
    {
      case VideoMode._360: return "360";
      case VideoMode.front: return "video_camera_back";
      case VideoMode.back: return "video_camera_front";
      case VideoMode.pip: return "picture_in_picture";
    }
  }

  public getVideoModeText(mode: VideoMode)
  {
    switch(mode)
    {
      case VideoMode._360: return "360°";
      case VideoMode.front: return "Fahrtrichtung";
      case VideoMode.back: return "Gegenrichtung";
      case VideoMode.pip: return "Bild im Bild";
    }
  }

  public onChangeVideoMode(event: MatSelectChange)
  {
    this.router.navigate(this.getRoute(this.currentTrack!.nr!, this.currentTime, event.value));
  }

  public syncPlayer2()
  {
    if (!this.youtubePlayer2) return;
    this.youtubePlayer2.mute();
    if (this.playing)
    {
      this.youtubePlayer2.seekTo(this.youtubePlayer.getCurrentTime(), true);
      this.youtubePlayer2.playVideo();
    }
    else
      this.youtubePlayer2.pauseVideo();
    if (this.youtubePlayer) this.youtubePlayer2.setPlaybackRate(this.youtubePlayer.getPlaybackRate());
  }
}
