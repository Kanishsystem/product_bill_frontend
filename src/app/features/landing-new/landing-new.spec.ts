import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingNew } from './landing-new';

describe('LandingNew', () => {
  let component: LandingNew;
  let fixture: ComponentFixture<LandingNew>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingNew]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LandingNew);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
