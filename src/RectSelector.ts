import { Area } from './Area';
import { Selector, SelectorDisconnector } from './Selector';
import { Rect, RectLike } from './Rect';

import './RectSelector.css';

export interface RectSelectorOptions {
  lassoClass: string;
  minEdge: number;
  appendTo: Element;
  boundary(element: Element): RectLike;
}

const defaults: RectSelectorOptions = {
  lassoClass: 'selekter-lasso',
  minEdge: 10,
  boundary: element => element.getBoundingClientRect(),
  appendTo: document.body
}

interface Offset {
  left: number;
  top: number;
}

export class RectSelector extends Rect implements Selector {
  private area: Area;
  private lasso: HTMLElement;

  private origin: Offset;
  private pendingRenderID: number;
  private preserveSelection: boolean;
  
  constructor(private options?: Partial<RectSelectorOptions>) {
    super();
    this.options = {...defaults, ...options};
  }

  connect(area: Area): SelectorDisconnector {
    this.area = area;
    document.addEventListener('mousedown', this.onMouseDown);
    return () => document.removeEventListener('mousedown', this.onMouseDown);
  }

  private onMouseDown = (event: MouseEvent) => {
    if (event.button === 0 && (event.target === document.documentElement || event.target === this.area.root)) {
      this.origin = this.getPageCoordinates(event);
      this.preserveSelection = event.ctrlKey || event.metaKey;
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
      event.preventDefault();
    }
  }

  private onMouseMove = (event: MouseEvent) => {
    event.preventDefault();
    let mouse = this.getPageCoordinates(event);

    this.top = Math.min(this.origin.top, mouse.top);
    this.left = Math.min(this.origin.left, mouse.left);
    this.width = Math.abs(this.origin.left - mouse.left);
    this.height = Math.abs(this.origin.top - mouse.top);

    if (this.edgeLongerThan(this.options.minEdge)) {
      if (!this.lasso) {
        this.lasso = this.options.appendTo.appendChild(this.createLassoElement());
      }
      this.requestRender();
      this.setVisible(true);
    } else if (this.lasso) {
      this.setVisible(false);
    }
    this.update();
  }

  private onMouseUp = () => {
    this.cancelRender();
    this.update();
    this.setVisible(false);

    this.width = this.height = 0;

    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  private update = () => {
    let selection = this.area.getSelection();
    this.area.getSelectables().forEach(element => {
      selection.toggle(element, this.preserveSelection
        && selection.has(element)
        || this.edgeLongerThan(this.options.minEdge)
        && this.intersects(this.translateByScroll(Rect.from(this.options.boundary(element)))));
    });
  }

  private requestRender() {
    if (!this.pendingRenderID) {
      this.pendingRenderID = requestAnimationFrame(this.render);
    }
  }

  private cancelRender() {
    if (this.pendingRenderID) {
      cancelAnimationFrame(this.pendingRenderID);
      this.pendingRenderID = 0;
    }
  }

  private render = () => {
    let style = this.lasso.style;
    style.left = this.left + 'px';
    style.top = this.top + 'px';
    style.width = this.width  + 'px';
    style.height = this.height  + 'px';
    this.pendingRenderID = 0;
  }

  private setVisible(visible: boolean) {
    this.lasso.style.display = visible ? '' : 'none';
  }

  private edgeLongerThan(length: number) {
    return this.width >= length || this.height >= length;
  }

  private translateByScroll<T extends Offset>(offset: T): T {
    let body = document.body;
    let html = document.documentElement;
    offset.left += body.scrollLeft || html.scrollLeft;
    offset.top += body.scrollTop || html.scrollTop;
    return offset;
  }

  private getPageCoordinates(event: MouseEvent) {
    return this.translateByScroll({ left: event.clientX, top: event.clientY }); 
  }

  private createLassoElement() {
    let element = document.createElement('div');
    element.classList.add(this.options.lassoClass);
    return element;
  }

}