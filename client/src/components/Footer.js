import React from 'react';
import PropTypes from 'prop-types';
import styles from './Footer.cm.styl';

function Footer({ onCoffeeClick }) {
  return (
    <div className={styles.base}>
      <button className={styles.btnCoffee} onClick={onCoffeeClick}>
        ☕ 请我喝咖啡
      </button>
      <div className={styles.footerLinks}>
        <a href="https://github.com/xiaoyaozz/deershare" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
          GitHub
        </a>
        <span className={styles.footerDivider}></span>
        <a href="mailto:support@deershare.com" className={styles.footerLink}>
          联系我们
        </a>
      </div>
      <div className={styles.copyright}>
        © {new Date().getFullYear()} 极速传输
      </div>
    </div>
  );
}

Footer.propTypes = {
  onCoffeeClick: PropTypes.func,
};

export default Footer;
