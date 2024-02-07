import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VRViewComponent } from './vr-view.component';

describe('VRViewComponent', () => {
  let component: VRViewComponent;
  let fixture: ComponentFixture<VRViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VRViewComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VRViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
