import React from 'react';
import {
  Switch,
  Route,
  Link,
} from 'react-router-dom';
import ws from '../ws';
import SendFilePanel from '../components/SendFilePanel';
import RecvFilePanel from '../components/RecvFilePanel';
import Footer from '../components/Footer';
import CoffeeModal from '../components/CoffeeModal';

import styles from './HomePage.cm.styl';

class HomePage extends React.Component {
  constructor() {
    super();
    this.state = {
      send: {
        curStep: 1,
        files: [],
        peerState: '',
        waitingPrepareSend: false,
      },
      recv: {
        recvCode: '',
        peerState: '',
        started: false,
        files: [],
        targetId: '',
      },
      coffeeOpen: false,
    };

    this.setSendState = this.setSendState.bind(this);
    this.setRecvState = this.setRecvState.bind(this);
    this.onS2cPrepareSend = this.onS2cPrepareSend.bind(this);
    this.onS2cPrepareRecv = this.onS2cPrepareRecv.bind(this);
    this.openCoffee = this.openCoffee.bind(this);
    this.closeCoffee = this.closeCoffee.bind(this);
  }

  onS2cPrepareSend(payload) {
    this.setSendState({
      recvCode: payload.recvCode,
    });
    if (this.state.send.curStep === 1) {
      this.setSendState({
        curStep: 2,
        waitingPrepareSend: false,
      });
    }
  }

  onS2cPrepareRecv(payload) {
    this.setRecvState({
      targetId: payload.clientId,
      files: payload.files,
    });
  }

  componentDidMount() {
    ws.registerMessageHandler('s2c_prepare_send', this.onS2cPrepareSend);
    ws.registerMessageHandler('s2c_prepare_recv', this.onS2cPrepareRecv);
  }

  setSendState(newState) {
    this.setState(prevState => {
      const nextState = {
        ...prevState,
        send: {
          ...prevState.send,
          ...newState,
        },
      };
      return nextState;
    });
  }

  setRecvState(newState) {
    this.setState(prevState => {
      const nextState = {
        ...prevState,
        recv: {
          ...prevState.recv,
          ...newState,
        },
      };
      return nextState;
    });
  }

  openCoffee() {
    this.setState({ coffeeOpen: true });
  }

  closeCoffee() {
    this.setState({ coffeeOpen: false });
  }

  renderLanding() {
    return (
      <div className={styles.landing}>
        <div className={styles.header}>
          <h1 className={styles.title}>⚡ 极速传输</h1>
          <p className={styles.subtitle}>端到端加密 · 点对点直连</p>
        </div>
        <div className={styles.heroText}>
          <p className={styles.tagline}>安全 • 快速 • 简单</p>
          <h2 className={styles.heroSubtitle}>设备间直接共享文件</h2>
          <p className={styles.heroDesc}>无需登录，无需安装，浏览器即可完成端到端加密传输</p>
        </div>
        <div className={styles.btnGroup}>
          <Link to="/send" className={`${styles.btn} ${styles.btnSend}`}>
            <span className={styles.btnIcon}>📤</span> 发送文件
          </Link>
          <Link to="/recv" className={`${styles.btn} ${styles.btnReceive}`}>
            <span className={styles.btnIcon}>📥</span> 接收文件
          </Link>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className={styles.container}>
        <div className={styles.main}>
          <Switch>
            <Route exact path="/">
              {this.renderLanding()}
            </Route>
            <Route path="/send">
              <SendFilePanel {...this.state.send} setState={this.setSendState} />
            </Route>
            <Route path="/recv/:recvCode?">
              <RecvFilePanel {...this.state.recv} setState={this.setRecvState} />
            </Route>
          </Switch>
        </div>
        <Footer onCoffeeClick={this.openCoffee} />
        <CoffeeModal open={this.state.coffeeOpen} onClose={this.closeCoffee} />
      </div>
    );
  }
}

export default HomePage;
