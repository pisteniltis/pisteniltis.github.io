import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TrackService } from '../track.service';
import { delay, of } from 'rxjs';

declare var YouTubeToHtml5: any;

@Component({
  selector: 'app-vr-view',
  templateUrl: './vr-view.component.html',
  styleUrls: ['./vr-view.component.scss']
})
export class VRViewComponent implements OnInit {

  videoId?: string;

  @ViewChild("video") video: any;

  constructor(private route: ActivatedRoute, public trackService: TrackService) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const track = this.trackService.tracksById[params.get('id')!];
      this.videoId = track.video;
      this.setupVideo();
    })
  }

  setupVideo(): void {
    if (!this.video)
      of([null]).pipe(delay(500)).subscribe(() => {this.setupVideo();})
    else
    {
      this.video.nativeElement.setAttribute("youtube", "https://youtu.be/" + this.videoId);
      new YouTubeToHtml5({ selector: 'video[youtube]', attribute: 'youtube' });
    }
  }
}
