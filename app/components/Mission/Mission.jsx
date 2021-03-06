import styles from './_Mission.scss';

import React from 'react';
import Footer from '../Footer/Footer';
import Actor from '../../class/Actor';
import DumbObject from '../../class/DumbObject';
import SpaceStation from '../../class/SpaceStation';
import AiShip from '../../class/AiShip';
import Ship from '../../class/Ship';
import GameComponent from '../Game/Game';
import DashboardComponent from '../Dashboard/Dashboard';
import KeyboardController from '../../services/Keyboard';
import KeyboardActions from '../../services/KeyboardActions';
import MissionService from '../../services/Mission';
import Game from '../../services/Game';
import touchPad from '../../util/touchPad';
import gameUtils from '../../util/game';
import numberUtils from '../../util/number';
import screenUtils from '../../util/screen';

import playerShipData from '../../data/playerShip.json';
import harrisonShipData from '../../data/harrisonShip.json';
import alienClass1Data from '../../data/alienClass1.json';
import alienClass2Data from '../../data/alienClass2.json';
import spaceStationData from '../../data/spaceStation.json';
import frozenMoonData from '../../data/frozenMoon.json';

const configs = {
  playerShip: Object.assign({}, playerShipData),
  harrisonShip: Object.assign({}, harrisonShipData),
  alienClass1: Object.assign({}, alienClass1Data),
  alienClass2: Object.assign({}, alienClass2Data),
  frozenMoon: Object.assign({}, frozenMoonData),
  spaceStation: Object.assign({}, spaceStationData)
};

const classMap = {
  'AiShip': AiShip,
  'Ship': Ship,
  'SpaceStation': SpaceStation,
  'DumbObject': DumbObject,
  'Actor': Actor
};

const injectImages = ( config ) => {
  config.imageUrls.forEach( ( name ) => {
    const img =  document.createElement( 'img' );
    require( `file?!../../assets/${ name }` );
    img.src = `/assets/${ name }`;
    config.images.push( img );
  });

  return config;
};

Object.keys( configs ).forEach( ( key ) => {
  let config = configs[ key ];
  config = injectImages( config );
});

export default class MissionComponent extends React.Component {

  state = {
    canvas: {},
    running: true,
    playerShip: {},
    actors: [],
    shots: [],
    showGuides: true,
    showMap: true,
    stats: [],
    score: {
      score: 0
    },
    map: {},
    // all current touch objects
    touches: [],
    // target / bool key val pairs - ie { left: true, up: false }
    targetTouches: {},
    touchState: 'state touches',
    nativeTouchState: 'native'
  }

  subscriptions = []

  playerShip = null

  mission = null

  gameClock = null

  getActorClass ( data ) {

    const getClass = ( classKey ) => {
      return classMap[ classKey ];
    };

    const ClassType = getClass( data._class );
    return new ClassType(
      this.state.canvas,
      Object.assign(
        {},
        configs[ data.type ],
        data
      )
    );
  }

  cumulativeDelta = 0

  updatePerMilliseconds ( delta, ms = 1000 ) {
    this.cumulativeDelta += delta;
    if ( this.cumulativeDelta < ms ) {
      return;
    }

    this.cumulativeDelta = this.cumulativeDelta % ms;

    /* **** UPDATE THE GAME'S STATE **** */
    this.setState({
      stats: this.getStats()
    });
  }

  updateGame ( delta ) {

    if ( screenUtils.isTouch ) {
      const touches = this.state.touches;
      const targetTouches = {};
      const targets = touchPad.getTargets();

      Object.keys(targets).forEach( ( key ) => {
        targetTouches[ key ] = touchPad.touches[ key ]( touches, targets );
      });

      this.setState({
        targetTouches: targetTouches
      });


      this.setState({ touchState: `update game - targetTouches: ${ JSON.stringify(targetTouches) }` });

      if ( targetTouches.left ) { this.playerShip.turnLeft( delta ); }
      if ( targetTouches.right ) { this.playerShip.turnRight( delta ); }
      if ( targetTouches.up ) { this.playerShip.accelerate( delta ); }
      if ( targetTouches.down ) { this.playerShip.decelerate( delta ); }
      if ( targetTouches.fire1 ) { this.playerShip.shoot(); }
      if ( targetTouches.fire2 ) { this.playerShip.bomb(); }
    }

    /* **** GENERATE THINGS **** */

    const addActor = ( data = {} ) => {
      const defaultParams = {
        _class: 'AiShip',
        type: 'alienClass1',
        x: Math.floor(Math.random() * 4000 - 2000),
        y: Math.floor(Math.random() * 4000 - 2000),
        speed: Math.floor(Math.random() * 200),
        direction: Math.floor(Math.random() * 360)
      };

      this.mission.actors.push( this.getActorClass( Object.assign( defaultParams, data ) ) );
    };

    if ( this.mission.actors.length < this.mission.settings.maxEnemies ) {

      gameUtils.doProbablyPerSeconds( delta, 60, () => {
        addActor( { type: 'alienClass1' } );
      });

      gameUtils.doProbablyPerSeconds( delta, 60, () => {
        addActor( { type: 'alienClass2' } );
      });
    }

    const playerShots = this.playerShip.state.shots; // .concat(blah.shots..)
    const enemyShots = this.mission.actors
      // filter only actors with shots
      .filter( ( actor ) => {
        return Boolean( actor.state.shots && actor.state.shots.length );
      })
      // return the shots
      .map( ( actor ) => actor.state.shots )
      // flatten into single array
      .reduce( ( shotsA, shotsB ) => {
        return shotsA.concat( shotsB );
      }, []);

    /* **** UPDATE THINGS **** */
    // update the Player ship
    this.playerShip.target = this.mission.actors.sort( ( a, b ) => {
      return Boolean( gameUtils.getDistance( this.playerShip.circle, a.circle ) > gameUtils.getDistance( this.playerShip.circle, b.circle ) ) ? 1 : -1;
    })[0];
    this.playerShip.update( delta );

    // update the other ships
    this.mission.actors.forEach( ( thing ) => {
      thing.target = this.playerShip;
      thing.update( delta );
    });

    // update the shots
    playerShots.forEach( ( shot ) => {
      shot.update( delta );
    });
    enemyShots.forEach( ( shot ) => {
      shot.update( delta );
    });

    /* **** COLLISION DETECTION **** */
    // handle collisions between ships and ships
    this.mission.actors.forEach( ( thing ) => {
      gameUtils.handleCollision( thing, this.playerShip, delta );
    });

    // handle collisions between shots and ships
    playerShots.forEach( ( shot ) => {
      this.mission.actors.forEach( ( thing ) => {
        gameUtils.handleCollision( thing, shot, delta );
      });
    });

    enemyShots.forEach( ( shot ) => {
      gameUtils.handleCollision( shot, this.playerShip, delta );
    });

    // TODO: paint collisions
    // filter out dead ships after collisions
    this.mission.actors = this.mission.actors.filter( ( actor ) => {
      return actor.alive;
    });

    const allShots = playerShots.concat(enemyShots);

    /* **** UPDATE THE GAME'S STATE **** */
    this.setState({
      playerShip: this.playerShip.state,
      actors: this.mission.actors.map( ( actor ) => actor.state ),
      shots: allShots.map( ( shot ) => shot.state ),
      map: this.getMapState()
    });

    this.updatePerMilliseconds( delta, 200 );
  }

  getStats () {
    const stats = [];

    // stats.push({ label: 'Health', value: numberUtils.toPrecision( this.playerShip.health, 3 ) });
    stats.push({ label: 'Health', value: numberUtils.toPrecision( this.playerShip.health, 3 ) });
    stats.push({ label: 'UFOs', value: this.mission.actors.length });
    stats.push({ label: 'Enemy shots', value: this.state.shots.length - this.playerShip.state.shots.length });
    stats.push({ label: 'Friendly shots', value: this.playerShip.state.shots.length });
    stats.push({ label: 'Speed', value: numberUtils.toPrecision( this.playerShip.state.speed, 1 ) });
    stats.push({ label: 'Heading', value: numberUtils.toPrecision( this.playerShip.state.direction, 2 ) });
    stats.push({ label: 'Longitude', value: numberUtils.toPrecision( this.playerShip.circle.y, 1 ) });
    stats.push({ label: 'Latitude', value: numberUtils.toPrecision( this.playerShip.circle.x, 1 ) });
    stats.push({ label: 'FPS avg', value: this.gameClock.fpsAverage });
    stats.push({ label: 'FPS now', value: this.gameClock.fpsAverage });


    return stats;
  }

  getMapState () {

    const mapScale = 20;
    const mapSize = 0.25;
    const scaleFactor = ( 1 / mapScale ) * mapSize;
    const mapCanvas = {
      width: this.state.canvas.width * mapScale,
      height: this.state.canvas.height * mapScale
    };

    let otherShipsCoords = [];

    if ( this.state.showMap ) {
      otherShipsCoords = this.mission.actors.map( ( actor ) => {
        return {
          x: Math.floor( gameUtils.getXPositionOffset( actor.state, this.playerShip.state, mapCanvas ) * scaleFactor ),
          y: Math.floor( gameUtils.getYPositionOffset( actor.state, this.playerShip.state, mapCanvas ) * scaleFactor ),
          isFriendly: actor.state._class !== 'AiShip'
        }
      });
    }

    return {
      direction: this.playerShip.state.direction,
      ships: otherShipsCoords,
      width: Math.floor( mapCanvas.width * scaleFactor ),
      height: Math.floor( mapCanvas.height * scaleFactor )
      // width: 305,
      // height: 160
    };
  }

  getKeyboardActions () {

    const gameActions = {
      pause: () => {
        console.log('pause toggle');
        this.gameClock.toggle();
      },
      save: () => {
        console.log('try save now');
      },
      guides: () => {
        if (! this.gameClock.isRunning ) { return; }
        this.setState({ showGuides: !this.state.showGuides }); // toggle guides
      },
      map: () => {
        if (! this.gameClock.isRunning ) { return; }
        this.setState({ showMap: !this.state.showMap }); // toggle map
      }
    };

    return KeyboardActions.getActions( this.playerShip, gameActions );
  }

  reset () {

  }

  save ( name ) {

    const stripImages = ( state ) => {
      const copy = Object.assign({}, state);
      delete copy.images;
      return copy;
    };

    MissionService.save( name, {
      playerShip: stripImages( this.playerShip.state ),
      actors: this.mission.actors.map( ( actor ) => {
        return stripImages( actor.state );
      })
    })
  }

  onSaveClicked ( event ) {

    const { inputSaveMission } = this.refs;
    console.log( event, inputSaveMission && inputSaveMission.value );
    if ( inputSaveMission && inputSaveMission.value ) {
      this.save( inputSaveMission.value );
    }
  }

  onCanvasClicked ( event ) {
    console.log( event );
  }

  // missionData could be the initial config or an
  // extended saved game
  loadMission ( missionKey ) {

    this.setState({
      canvas: screenUtils.getDimensions()
    });

    this.reset();
    const missionData = MissionService.load( missionKey );
    if ( !missionData ) { return; }

    this.mission = {
      settings: missionData.settings
    };

    const canvasConfig = screenUtils.getDimensions();

    this.setState({
      canvas: canvasConfig
    });

    this.playerShip = this.getActorClass(
      Object.assign(
        {
          x: canvasConfig.width * 0.5,
          y: canvasConfig.height * 0.5
        },
        missionData.playerShip
      )
    );

    this.mission.actors = missionData.actors.map( ( data ) => {
      return this.getActorClass( data );
    });

    this.gameClock = Game.Clock();
    this.gameClock.start();
    // add actions to keyboard events
    this.KeyboardController = new KeyboardController( this.gameClock, this.getKeyboardActions() );
    this.KeyboardController.bind();

    this.gameClock.addAction( ( delta ) => {
      this.updateGame( delta );
    });
  }

  // update state

  addTouch = ( touch ) => {
    const touches = this.state.touches;
    this.setState({ nativeTouchState: `addTouch - touch: ${ typeof touch }` });
    touches.push( { identifier: touch.identifier, pageX: touch.pageX, pageY: touch.pageY } );
    this.setState({ touches: touches });
    this.setState({ nativeTouchState: `addTouch - touches: ${ touches.map( touch => JSON.stringify( touch ) ).join(' - ') }` });
  }

  replaceTouch = ( newTouch ) => {
    const touches = this.state.touches.map( ( touch ) => {
      if ( newTouch.identifier === touch.identifier ) {
        return { identifier: touch.identifier, pageX: newTouch.pageX, pageY: newTouch.pageY };
      }
      return touch;
    });

    this.setState({ touches: touches });
    this.setState({ nativeTouchState: `replaceTouch - touches: ${ touches.map( touch => JSON.stringify( touch ) ).join(' - ') }` });
  }

  removeTouch = ( touchToRemove ) => {
    const touches = this.state.touches.filter( ( touch ) => {
      return Boolean( touchToRemove.identifier !== touch.identifier );
    });

    this.setState({ touches: touches });
    this.setState({ nativeTouchState: `removeTouch - touches: ${ touches.map( touch => JSON.stringify( touch ) ).join(' - ') }` });
  }

  // react core methods

  componentWillMount () {
    const canvasConfig = screenUtils.getDimensions();

    // This is breaking mobile!!??
    // React.initializeTouchEvents(true);

    this.setState({
      canvas: canvasConfig
    });
  }

  componentWillUnmount () {

    this.gameClock.stop();
    this.gameClock = null;

    this.KeyboardController.unbind();
    this.KeyboardController = null;

    this.subscriptions.forEach( ( subscription) => {
      subscription.dispose();
    });
  }

  componentDidMount () {
    const missionKey = this.props.location.query.key;
    if ( missionKey ) {
      this.loadMission( missionKey );
    }
  }

  renderPauseScreen () {
    if ( this.gameClock && !this.gameClock.isRunning ) {
      return (
        <div className={ styles.pause }>
          <h2>Mission paused</h2>
          <input ref="inputSaveMission" type="text" />
          <button onClick={ this.onSaveClicked.bind(this) }>Save mission</button>
        </div>
      );
    }

    return null;
  }

  renderDashboard () {

    if ( screenUtils.isTouch ) { return; }

    return (
      <DashboardComponent
        stats={ this.state.stats }
      />
    );
  }

  renderTouchControls () {
    if ( !screenUtils.isTouch ) { return; }

    const getCanvasElement = () => {
      return this.refs.touchCanvas;
    };

    const handleStart = ( evt ) => {
      const el = getCanvasElement();
      const touches = evt.changedTouches;

      let index = 0;
      for ( index; index < touches.length; index++ ) {
        const touch = touches.item( index );
        this.setState({ nativeTouchState: `handleStart - touch: ${ typeof touch }` });
        this.addTouch( touch );
      }
      evt.preventDefault();
    };

    const handleMove = ( evt ) => {
      const el = getCanvasElement();
      const touches = evt.changedTouches;
      this.setState({ nativeTouchState: `move - touches: ${ touches.length }` });
      evt.preventDefault();
      let index = 0;
      for ( index; index < touches.length; index++ ) {
        const touch = touches.item( index );
        this.replaceTouch( touch );
      }
    };

    const handleEnd = ( evt ) => {
      const el = getCanvasElement();
      const touches = evt.changedTouches;
      this.setState({ nativeTouchState: `end - touches: ${ touches.length }` });
      evt.preventDefault();
      let index = 0;
      for ( index; index < touches.length; index++ ) {
        const touch = touches.item( index );
        this.removeTouch( touch );
      };
    };

    const handleCancel = ( evt ) => {
      const touches = evt.changedTouches;
      let index = 0;
      for ( index; index < touches.length; index++ ) {
        const touch = touches.item( index );
        this.setState({ nativeTouchState: `cancel - touches: ${ touches.length }` });
        this.removeTouch( touch );
      };
      evt.preventDefault();
    };

    let touchLog = 'Touch log:<br>';

    touchLog += this.state.touches.map( ( touch ) => {
      return `x: ${ touch.pageX } y: ${ touch.pageY }<br>`;
    }).join('');

    const targets = touchPad.getTargets();

    return (
      <div className={ styles.touchCanvas }
        ref="touchCanvas"
        onTouchStart={ handleStart.bind( this ) }
        onTouchMove={ handleMove.bind( this ) }
        onTouchEnd={ handleEnd.bind( this ) }
        onTouchCancel={ handleCancel.bind( this ) }
      >
        {
          Object.keys(targets).map( ( key ) => {
            const target = targets[ key ];
            const className = `${ key }Button`;
            const styles = {
              top: target.y1,
              left: target.x1,
              width: target.x2 - target.x1,
              height: target.y2 - target.y1,
              backgroundColor: 'rgba( 255, 255, 255, 0.1 )'
            };

            if ( this.state.targetTouches[ key ] ) {
              styles.backgroundColor = 'rgba( 255, 255, 255, 0.2 )';
            }

            return (
              <div key={ key }
                className={ className }
                style={ styles }
              >{ key }</div>
            );
          })
        }
        <article className={ styles.touchLog }>
          <p>{ this.state.nativeTouchState }</p>
          <p>{ this.state.touchState }</p>
        </article>
      </div>
    );
        // <div className={ styles.touchLog } dangerouslySetInnerHTML={ { __html: touchLog } } />
  }

  render () {

    return (
      <div className={ styles.mission }>
        { this.renderPauseScreen() }
        <GameComponent
          playerShip={ this.state.playerShip }
          actors={ this.state.actors }
          shots={ this.state.shots }
          score={ this.state.score }
          map={ this.state.map }
          showGuides={ this.state.showGuides }
          showMap={ this.state.showMap }
          canvas={ this.state.canvas }
          onCanvasClicked={ this.onCanvasClicked }
        />
        { this.renderDashboard() }
        { this.renderTouchControls() }
      </div>
    );
  }
}
