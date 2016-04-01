import styles from './_App.scss';

import React from 'react';
import Rx from 'rx';
import AppActions from '../../actions/AppActions';
import ItemsStore from '../../stores/ItemsStore';
import Body from '../Body/Body';
import Footer from '../Footer/Footer';
import Hero from '../../class/Hero';
import GameComponent from '../Game/Game';
import KeyboardService from '../../services/Keyboard';
import Game from '../../services/Game';
import defaultKeyActions from '../../data/defaultKeyActions.json';
import gameUtils from '../../util/game';
import objectUtils from '../../util/object';

require("file?!../../assets/will_ship_sp0.png");
require("file?!../../assets/will_ship_sp1.png");
require("file?!../../assets/will_ship_sp2.png");
require("file?!../../assets/will_ship_sp3.png");
require("file?!../../assets/will_ship_sp4.png");
require("file?!../../assets/will_ship_sp5.png");

const daddyShipImages = [];
daddyShipImages.push(document.createElement('img'));
daddyShipImages.push(document.createElement('img'));
daddyShipImages.push(document.createElement('img'));
daddyShipImages.push(document.createElement('img'));
daddyShipImages.push(document.createElement('img'));
daddyShipImages.push(document.createElement('img'));

daddyShipImages.forEach( ( ds, index ) => {
    ds.src = `/assets/will_ship_sp${ index }.png`;
});

// const GameInstance = GameService.initGame();

export default class App extends React.Component {

  static propTypes = {
    canvasConfig: React.PropTypes.shape({
      width: React.PropTypes.number,
      height: React.PropTypes.number
    })
  }

  state = {
    running: true,
    hero: {},
    enemies: [],
    shots: [],
    score: {
      score: 10
    },
    data: {
      somethings: [ 1, 2, 3 ]
    }
  }

  subscriptions = [];

  renderConsoleOutput = () => {
    // TODO: This needs to iterate through an array/object to output anything
    // needed in the console
    return (
      <div>
        <h3>Console</h3>
      </div>
    );
  }

  componentDidMount() {

    this.gameClock = Game.Clock(20);
    const { canvasConfig } = this.props;

    const initialHeroSettings = {
      _ready: true,
      type: 'hero',
      name: 'Daddy Ship Class I',
      health: 1,
      power: 1,
      size: 180,
      speed: 0,
      acceleration: 300,
      breaking: 450,
      maxSpeed: 1000,
      turnSpeed: 90,
      x: canvasConfig.width * 0.5,
      y: canvasConfig.height * 0.5,
      direction: 0,
      images: daddyShipImages,
      shotHealth: 2,
      shotPower: 0.2,
      shotSpeed: 900,
      shotLifeSpan: 200
    };

    const hero = new Hero( canvasConfig, initialHeroSettings );


    const enemy1 = new Hero( canvasConfig, { direction: 135 } );
    
    let allThings = [];

    allThings.push( enemy1 );

    this.gameClock.start();
    // add actions to keyboard events
    KeyboardService.Controller( this.gameClock, this.getKeyboardActions( hero ) );
    this.gameClock.addAction( ( delta ) => {
      // render scene here...
      hero.update( delta );

      let allShots = hero.state.shots; // .concat(blah.shots..)

      allShots.forEach( ( shot ) => {
        shot.update( delta );
      });

      allThings.forEach( ( thing ) => {
        thing.update( delta );
      });

      //coliision


      allThings.forEach( ( thing ) => {
        this.handleCollision( thing, hero );
      });


      allShots.forEach( ( shot ) => {
        // this.handleCollision( shot, hero );

        allThings.forEach( ( thing ) => {
          this.handleCollision( thing, shot );
        });

      });

      // need to paint collisions

      allThings = allThings.filter( ( thing ) => {
        return thing.alive;
      });



      this.setState({
        hero: hero.state
      });

      this.setState({
        enemies: allThings.map( ( thing ) => thing.state )
      });

      this.setState({
        shots: allShots.map( ( shot ) => shot.state )
      });
      
    });
  }

  handleCollision = ( thing1, thing2 ) => {
    const isCollision = this.getIsCollision( thing1.circle, thing2.circle );

    if ( isCollision ) {
      thing1.hit( thing2 );
      thing2.hit( thing1 );
    }
  }

  getIsCollision = ( circle1, circle2 ) => {
    const dx = Math.abs( circle1.x - circle2.x );
    const dy = Math.abs( circle1.y - circle2.y );
    const distance = Math.sqrt( dx * dx + dy * dy );
    return Boolean( distance < ( circle1.radius + circle2.radius ) );
  }

  getKeyboardActions ( hero ) {

    const keyCodeActionMap = {};

    const actions = {
      left: ( delta ) => {
        hero.turnLeft( delta );
      },
      right: ( delta ) => {
        hero.turnRight( delta );
      },
      up: ( delta ) => {
        hero.accelerate( delta );
      },
      down: ( delta ) => {
        hero.decelerate( delta );
      },
      fire: ( delta ) => {
        console.log('fire!');
        hero.shoot();
        // hero.shotCount++;
        // console.log('hero.shotCount', hero.shotCount);
      },
      pause: () => {
        console.log('pause toggle');
        this.gameClock.toggle();
      },
      roll: () => {
        // console.log('roll - ' + gameUtils.rollDice());
      }
    };

    Object.keys( defaultKeyActions ).forEach( ( key ) => {
      const keyCodes = defaultKeyActions[key];
      keyCodes.forEach( ( keyCode ) => {
        keyCodeActionMap[ objectUtils.getSafeKey( keyCode ) ] = actions[key];
      });
    });

    return keyCodeActionMap;
  }

  componentWillUnmount() {

    this.subscriptions.forEach( ( subscription) => {
      subscription.dispose();
    });
  }

  render() {

    const onCanvasClicked = ( event ) => {
      console.log(event);
    };

    return (
      <div className={styles.app}>
        <GameComponent
          hero={ this.state.hero }
          enemies={ this.state.enemies }
          shots={ this.state.shots }
          gameState={ this.state }
          canvas={ this.props.canvasConfig }
          onCanvasClicked={ onCanvasClicked }
        />
      </div>
    );
  }
}
