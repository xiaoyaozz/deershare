import React, { Component } from 'react';
import PropTypes from 'prop-types';
import prettyBytes from 'pretty-bytes';
import uuidv4 from 'uuid/v4';
import Dropzone from 'react-dropzone';

import Toast from './common/Toast';
import Peer from '../Peer';
import FileChunker from '../FileChunker';
import { calcPercent } from '../common/util';
import { prepareSend, deleteRecvCode } from '../actions/file';

import styles from './SendFilePanel.cm.styl';

class SendFilePanel extends Component {
  constructor(props) {
    super(props);
    this.peer = new Peer();
    this.onChangeFile = this.onChangeFile.bind(this);
    this.onRemoveFile = this.onRemoveFile.bind(this);
    this.onClickSelectDone = this.onClickSelectDone.bind(this);
    this.onClickBack = this.onClickBack.bind(this);
    this.onReset = this.onReset.bind(this);
    this.onRecvPeerData = this.onRecvPeerData.bind(this);
    this.handlePeerMsg = this.handlePeerMsg.bind(this);
    this.goHome = this.goHome.bind(this);

    this.sendSizes = {};
    this.lastPeerRecvBytes = 0;
    this.bps = 0;

    this.timer = setInterval(() => {
      const files = this.props.files.map(f => {
        const sendSize = this.sendSizes[f.uid] || 0;
        const pct = calcPercent(sendSize, f.size);
        return {
          ...f,
          pct,
        };
      });

      this.props.setState({ files, bps: this.bps });
      this.bps = 0;
    }, 1000);
  }

  componentDidMount() {
    document.title = '极速传输 - 发送文件';
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  goHome() {
    this.peer.destroy();
    this.props.setState({
      curStep: 1,
      files: [],
      peerState: '',
      waitingPrepareSend: false,
    });
    window.history.pushState({}, '', '/');
    const popEvent = new Event('popstate');
    window.dispatchEvent(popEvent);
  }

  onClickSelectDone() {
    this.props.setState({
      waitingPrepareSend: true,
    });

    const files = this.props.files.map(f => {
      return {
        uid: f.uid,
        name: f.name,
        size: f.size,
        type: f.type,
      };
    });
    prepareSend(files);

    const peer = this.peer;

    peer.on('connecting', () => {
      this.props.setState({
        peerState: 'connecting',
      });
    });

    peer.on('connected', () => {
      this.props.setState({
        peerState: 'connected',
      });
    });

    peer.on('connectFailed', () => {
      this.props.setState({
        peerState: 'connectFailed',
      });
      Toast.error('连接失败');
    });

    peer.on('disconnected', async() => {
      this.props.setState({
        peerState: 'disconnected',
      });
    });

    peer.on('channelOpen', async() => {
      this.props.setState({
        curStep: 3,
        peerState: 'transfer',
      });

      const files = this.props.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = file.uid;
        await peer.sendJSON({
          type: 'fileStart',
          fileId,
        });

        this.props.setState({
          curFileId: fileId,
        });

        const chunker = new FileChunker(file.realFile);
        let done = false;
        this.lastPeerRecvBytes = 0;
        while (!done) {
          const result = await chunker.getNextChunk();
          done = result.done;
          const {
            chunk,
          } = result;
          try {
            await peer.send(chunk);
          } catch (err) {
            Toast.error('传输错误：' + err);
            break;
          }
        }
        if (done) {
          await peer.sendJSON({
            type: 'fileEnd',
            fileId,
          });
        }
      }
    });

    peer.on('data', this.onRecvPeerData);
  }

  onRecvPeerData(data) {
    if (typeof data === 'string') {
      const msg = JSON.parse(data);
      this.handlePeerMsg(msg);
    }
  }

  handlePeerMsg(msg) {
    const {
      type,
      payload,
    } = msg;

    if (type === 'chunkReceived') {
      const {
        fileId,
        recvBytes,
      } = payload;
      this.sendSizes[fileId] = recvBytes;
      this.bps += (recvBytes - this.lastPeerRecvBytes);
      this.lastPeerRecvBytes = recvBytes;
    }
  }

  onClickBack() {
    deleteRecvCode(this.props.recvCode);
    this.props.setState({ curStep: this.props.curStep - 1 });
  }

  onReset() {
    this.peer.destroy();
    this.props.setState({
      curStep: 1,
      files: [],
      peerState: '',
      waitingPrepareSend: false,
    });
  }

  onChangeFile(files) {
    const filteredFiles = files.filter(f => {
      const existed = this.props.files.find(_f1 => {
        const f1 = _f1.realFile;
        if (f1.name === f.name && f1.size === f.size && f1.lastModified === f.lastModified && f1.type === f.type) {
          return true;
        }
        return false;
      });
      return !existed;
    }).map(f => {
      return {
        realFile: f,
        uid: uuidv4(),
        name: f.name,
        size: f.size,
        type: f.type,
      };
    });

    if (filteredFiles.length !== files.length) {
      Toast.info('发现疑似相同的文件，已自动过滤');
    }

    const nextFiles = this.props.files.concat(filteredFiles);
    this.props.setState({
      files: nextFiles,
    });
    event.target.value = null;
  }

  onRemoveFile(uid) {
    return () => {
      const nextFiles = this.props.files.filter(f => f.uid !== uid);
      this.props.setState({ files: nextFiles });
    };
  }

  renderStep1() {
    const {
      files,
      waitingPrepareSend,
    } = this.props;

    const totalBytes = files.reduce((sum, cur) => {
      return sum + cur.size;
    }, 0);

    return (
      <>
        <Dropzone onDrop={this.onChangeFile} noClick>
          {({ getRootProps, getInputProps, isDragActive, open }) => (
            <>
              <div
                className={`${styles.dropZone} ${isDragActive ? styles.dragActive : ''}`}
                {...getRootProps()}
              >
                <div className={styles.dropIcon}>📁</div>
                <p className={styles.dropText}>点击选择文件</p>
                <p className={styles.dropHint}>支持多个文件</p>
                <input {...getInputProps()} />
              </div>
              {files.length > 0 && (
                <>
                  {files.map(f => (
                    <div key={f.uid} className={styles.fileInfo}>
                      <div>
                        <div className={styles.fileName}>📄 {f.name}</div>
                        <div className={styles.fileSize}>{prettyBytes(f.size)}</div>
                      </div>
                      <span className={styles.fileRemove} onClick={this.onRemoveFile(f.uid)}>✕</span>
                    </div>
                  ))}
                  <div className={styles.fileSummary}>
                    {files.length} 个文件，共 {prettyBytes(totalBytes)}
                  </div>
                  <button
                    className={styles.btnSelectDone}
                    onClick={this.onClickSelectDone}
                    disabled={waitingPrepareSend}
                  >
                    {waitingPrepareSend ? '处理中...' : '选好了'}
                  </button>
                </>
              )}
            </>
          )}
        </Dropzone>
        <button className={styles.btnBack} onClick={this.goHome} title="返回首页">←</button>
      </>
    );
  }

  renderStep2() {
    const {
      recvCode,
    } = this.props;

    return (
      <>
        <div className={styles.codeDisplay}>
          <div className={styles.codeNumber}>{recvCode}</div>
          <div className={styles.codeHint}>📋 将上方验证码发送给接收方</div>
          <div className={styles.waitingHint}>等待接收方连接中…</div>
        </div>
        <button className={styles.btnBack} onClick={this.onClickBack} title="返回">←</button>
      </>
    );
  }

  renderStep3() {
    const {
      curFileId,
      files,
      peerState,
      bps,
    } = this.props;

    const totalBytes = files.reduce((sum, cur) => {
      return sum + cur.size;
    }, 0);

    let allCompleted = true;
    files.forEach(f => {
      if (f.pct < 100) {
        allCompleted = false;
      }
    });

    let statusMsg;
    let statusClass = styles.status;
    if (allCompleted) {
      statusMsg = '✅ 文件发送完成！';
      statusClass = `${styles.status} ${styles.success}`;
    } else if (peerState === 'connecting') {
      statusMsg = '正在连接…';
    } else if (peerState === 'connected') {
      statusMsg = '连接成功，正在传输…';
    } else if (peerState === 'transfer') {
      statusMsg = `正在发送...`;
    } else if (peerState === 'disconnected' || peerState === 'connectFailed') {
      statusMsg = '连接断开';
      statusClass = `${styles.status} ${styles.error}`;
    }

    const totalPct = files.length > 0
      ? Math.round(files.reduce((s, f) => s + parseFloat(f.pct || 0), 0) / files.length)
      : 0;

    return (
      <>
        <div className={statusClass}>{statusMsg}</div>
        {!allCompleted && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: totalPct + '%' }}></div>
            </div>
            <div className={styles.progressText}>{totalPct}%</div>
            <div className={styles.speedText}>{prettyBytes(bps || 0)}/s</div>
          </div>
        )}
        {files.map(f => {
          const pct = parseFloat(f.pct || 0);
          return (
            <div key={f.uid} className={styles.fileProgress}>
              <span className={styles.fileProgressName}>📄 {f.name}</span>
              <span className={pct >= 100 ? styles.fileProgressDone : styles.fileProgressPct}>
                {pct >= 100 ? '✅' : pct + '%'}
              </span>
            </div>
          );
        })}
        <button className={styles.btnBack} onClick={allCompleted ? this.onReset : this.onReset} title={allCompleted ? '继续发送' : '取消'}>
          {allCompleted ? '↩' : '←'}
        </button>
      </>
    );
  }

  render() {
    const {
      curStep,
    } = this.props;

    return (
      <div className={styles.container}>
        {curStep === 1 && this.renderStep1()}
        {curStep === 2 && this.renderStep2()}
        {curStep === 3 && this.renderStep3()}
      </div>
    );
  }
}

SendFilePanel.propTypes = {
  curStep: PropTypes.number,
  files: PropTypes.array,
  waitingPrepareSend: PropTypes.bool,
  curFileId: PropTypes.string,
  peerState: PropTypes.string,
  recvCode: PropTypes.string,
  bps: PropTypes.number,
  setState: PropTypes.func,
};

export default SendFilePanel;
