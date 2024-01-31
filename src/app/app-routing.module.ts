import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TrackGuard } from './track.guard';
import { TrackViewComponent } from './track-view/track-view.component';
import { environment } from 'src/environments/environment';

const routes: Routes = [
  { path: "", pathMatch: "full", canActivate: [TrackGuard], component: TrackViewComponent },
  { path: ":id", canActivate: [TrackGuard], component: TrackViewComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: !environment.production })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
