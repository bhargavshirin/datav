// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as React from 'react';

import renderIntoCanvas from './render-into-canvas';

import { TNil } from '../../../types/misc';

import colorGenerator from 'utils/colorGenerator';

type CanvasSpanGraphProps = {
  items: { valueWidth: number; valueOffset: number; serviceName: string }[];
  valueWidth: number;
  bg: string
};

const getColor = (hex: string) => colorGenerator.getRgbColorByKey(hex);

export default class CanvasSpanGraph extends React.PureComponent<CanvasSpanGraphProps> {
  _canvasElm: HTMLCanvasElement | TNil;

  constructor(props: CanvasSpanGraphProps) {
    super(props);
    this._canvasElm = undefined;
  }

  componentDidMount() {
    this._draw();
  }

  componentDidUpdate() {
    this._draw();
  }

  _setCanvasRef = (elm: HTMLCanvasElement | TNil) => {
    this._canvasElm = elm;
  };

  _draw() {
    if (this._canvasElm) {
      const { valueWidth: totalValueWidth, items,bg } = this.props;
      renderIntoCanvas(this._canvasElm, items, totalValueWidth, getColor,bg );
    }
  }

  render() {
    return <canvas className="CanvasSpanGraph" ref={this._setCanvasRef} style={{
      height: '60px',
      position: 'absolute',
      width: '100%'
    }} />;
  }
}
