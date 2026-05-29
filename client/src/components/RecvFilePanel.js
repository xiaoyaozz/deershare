import React, { Component } from 'react';
import PropTypes from 'prop-types';
import prettyBytes from 'pretty-bytes';
import { withRouter } from 'react-router-dom';
import Toast from './common/Toast';
import {
  prepareRecv,
  deleteRecvCode,
} from '../actions/file';
import Peer from '../Peer';
import {
  calcPercent,
} from '../common/util';

import styles from './RecvFilePanel.cm.styl';

class RecvFilePanel extends Component {
  constructor(props) {
    super(props);
    this.onChangeRecvCode = this.onChangeRecvCode.bind(this);
    this.onPrepareRecv = this.onPrepareRecv.bind(this);
    this.onStartRecv = this.onStartRecv.bind(this);
    this.onReset = this.onReset.bind(this);
    this.goHome = this.goHome.bind(this);

    this.onRecvPeerData = this.onRecvPeerData.bind(this);
    this.handlePeerMsg = this.handlePeerMsg.bind(this);

    this.peer = new Peer();
    this.recvBuffer = [];
    this.recvSizes = {};
    this.bps = 0;
    this.lastReportedRecvBytes = {};

    this.timer = setInterval(() => {
      const files = this.props.files.map(f => {
        const recvSize = this.recvSizes[f.uid] || 0;
        const pct = calcPercent(recvSize, f.size);
        return {
          ...f,
          pct,
        };
      });
      this.props.setState({
        files,
      });
      this.bps = 0;
    }, 1000);
  }

  componentDidMount() {
    document.title = '极速传输 - 接收文件';
    const recvCode = this.props.match.params.recvCode;
    if (recvCode) {
      prepareRecv(recvCode);
    }
  }

  componentWillUnMount() {
    clearInterval(this.timer);
  }

  goHome() {
    this.peer.destroy();
    this.props.setState({
      recvCode: '',
      peerState: '',
      started: false,
      files: [],
      targetId: '',
    });
    window.history.pushState({}, '', '/');
    const popEvent = new Event('popstate');
    window.dispatchEvent(popEvent);
  }

  onChangeRecvCode(value) {
    this.props.setState({ recvCode: value });
  }

  onPrepareRecv() {
    prepareRecv(this.props.recvCode);
  }

  onReset() {
    this.peer.destroy();
    this.props.setState({
      recvCode: '',
      peerState: '',
      started: false,
      files: [],
      targetId: '',
    });
  }

  onStartRecv() {
    this.props.setState({
      started: true,
    });

    const peer = this.peer;

    peer.on('connecting', () => {
      this.props.setState({
        peerState: 'connecting',
      });
    });

    peer.on('connected', () => {
      Toast.success('连接成功');
      this.props.setState({
        peerState: 'connected',
      });
    });

    peer.on('disconnected', () => {
      this.props.setState({
        peerState: 'disconnected',
      });
    });

    peer.on('connectFailed', () => {
      Toast.error('连接失败，请重试');
      this.props.setState({
        peerState: 'connectFailed',
      });
    });

    peer.on('channelOpen', () => {
      this.props.setState({
        peerState: 'transfer',
      });
      deleteRecvCode(this.props.recvCode || this.props.match.params.recvCode);
    });

    peer.on('data', this.onRecvPeerData);

    peer.connectPeer(this.props.targetId);
  }

  onRecvPeerData(data) {
    const {
      curFileId,
    } = this.props;

    if (typeof data === 'string') {
      const msg = JSON.parse(data);
      this.handlePeerMsg(msg);
    } else {
      this.recvBuffer.push(data);
      const curRecvBytes = this.recvSizes[curFileId] || 0;
      const newRecvBytes = curRecvBytes + data.byteLength;
      this.recvSizes[curFileId] = newRecvBytes;
      this.bps += data.byteLength;
      const lastReported = this.lastReportedRecvBytes[curFileId] || 0;
      if (newRecvBytes - lastReported >= 1048576) {
        this.lastReportedRecvBytes[curFileId] = newRecvBytes;
        this.peer.sendJSON({
          type: 'chunkReceived',
          payload: { fileId: curFileId, recvBytes: newRecvBytes },
        });
      }
    }
  }

  handlePeerMsg(msg) {
    if (msg.type === 'fileStart') {
      this.props.setState({
        curFileId: msg.fileId,
      });
    } else if (msg.type === 'fileEnd') {
      const fileId = msg.fileId;
      const file = this.props.files.find(f => f.uid === fileId) || {};
      const blob = new Blob(this.recvBuffer, { type: file.type });
      this.recvBuffer = [];
      const url = window.URL.createObjectURL(blob);
      const files = this.props.files.map(f => {
        if (f.uid === fileId) {
          return {
            ...f,
            downloadUrl: url,
          };
        } else {
          return f;
        }
      });
      this.props.setState({
        files,
      });
    }
  }

  renderStep1() {
    const {
      recvCode,
    } = this.props;

    return (
      <>
        <div className={styles.receiveArea}>
          <input
            className={styles.codeInput}
            placeholder="输入6位验证码"
            maxLength={6}
            value={recvCode}
            onChange={e => this.onChangeRecvCode(e.target.value)}
          />
          <button
            className={styles.btnRecv}
            onClick={this.onPrepareRecv}
            disabled={!recvCode || recvCode.length !== 6}
          >
            接收文件
          </button>
        </div>
        <button className={styles.btnBack} onClick={this.goHome} title="返回首页">←</button>
      </>
    );
  }

  renderStep2() {
    const {
      peerState,
      started,
      curFileId,
      files,
      bps,
    } = this.props;

    const totalBytes = files.reduce((sum, cur) => {
      return sum + cur.size;
    }, 0);

    let allCompleted = true;
    files.forEach(f => {
      if (!f.downloadUrl) {
        allCompleted = false;
      }
    });

    let statusMsg;
    let statusClass = styles.status;
    if (allCompleted) {
      statusMsg = '✅ 文件接收完成！';
      statusClass = `${styles.status} ${styles.success}`;
    } else if (!started) {
      statusMsg = '点击下方按钮开始下载';
    } else if (peerState === 'connecting') {
      statusMsg = '正在连接…';
    } else if (peerState === 'connected') {
      statusMsg = '连接成功，正在接收…';
    } else if (peerState === 'transfer') {
      statusMsg = '正在下载...';
    } else if (peerState === 'disconnected' || peerState === 'connectFailed') {
      statusMsg = '连接失败';
      statusClass = `${styles.status} ${styles.error}`;
    }

    const totalPct = files.length > 0
      ? Math.round(files.reduce((s, f) => s + parseFloat(f.pct || 0), 0) / files.length)
      : 0;

    return (
      <>
        <div className={statusClass}>{statusMsg}</div>

        {files.map(f => {
          const pct = parseFloat(f.pct || 0);
          let rightContent;
          if (f.downloadUrl) {
            rightContent = <span className={styles.fileRowDone}>下载</span>;
          } else if (pct >= 100) {
            rightContent = <span className={styles.fileRowDone}>完成</span>;
          } else {
            rightContent = <span className={styles.fileRowPct}>{pct}%</span>;
          }
          return (
            <div key={f.uid} className={styles.fileRow}>
              <span className={styles.fileRowName}>📄 {f.name}</span>
              {rightContent}
            </div>
          );
        })}

        {started && !allCompleted && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: totalPct + '%' }}></div>
            </div>
            <div className={styles.progressText}>{totalPct}%</div>
            <div className={styles.speedText}>{prettyBytes(bps || 0)}/s</div>
          </div>
        )}

        {!allCompleted && (
          <button
            className={styles.btnDownload}
            onClick={this.onStartRecv}
            disabled={started && peerState !== 'disconnected' && peerState !== 'connectFailed'}
          >
            {!started && '开始下载'}
            {started && (peerState === 'connecting') && '正在连接…'}
            {started && (peerState === 'transfer' || peerState === 'connected') && '下载中…'}
            {started && (peerState === 'disconnected' || peerState === 'connectFailed') && '重新下载'}
          </button>
        )}

        {allCompleted && (
          <button className={styles.btnDownload} onClick={this.onReset}>
            继续接收
          </button>
        )}

        <button className={styles.btnBack} onClick={allCompleted ? this.onReset : this.goHome} title={allCompleted ? '继续接收' : '返回首页'}>
          {allCompleted ? '↩' : '←'}
        </button>
      </>
    );
  }

  render() {
    const {
      files,
    } = this.props;

    return (
      <div className={styles.container}>
        {files.length === 0 && this.renderStep1()}
        {files.length > 0 && this.renderStep2()}
      </div>
    );
  }
}

RecvFilePanel.propTypes = {
  recvCode: PropTypes.string,
  peerState: PropTypes.string,
  started: PropTypes.bool,
  files: PropTypes.array,
  targetId: PropTypes.string,
  curFileId: PropTypes.string,
  bps: PropTypes.number,
  match: PropTypes.object,
  setState: PropTypes.func,
};

export default withRouter(RecvFilePanel);
