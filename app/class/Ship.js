
import Actor from './Actor';
import Shot from './Shot';
import gameUtils from '../util/game';
import HeadSfx from '../services/HeadSfx';
import SOUNDS from '../services/Sounds';

class Ship extends Actor {

  constructor ( canvas, props ) {

    const defaultProps = {
      _ready: true,
      _class: 'Ship',
      type: 'shipType',
      name: 'Alien Saucer Class I',
      health: 1,
      power: 1,
      size: 100,
      speed: 0,
      acceleration: 200,
      breaking: 450,
      maxSpeed: 800,
      turnSpeed: 90,
      strafeSpeed: 150,
      x: 0,
      y: 0,
      direction: 0,
      shotHealth: 1,
      shotPower: 0.1,
      shotSpeed: 900,
      shotLifeSpan: 1000,
      shots: []
    };

    super( canvas, props, defaultProps );

    // loading shots needs some more thought
    this._state.shots = [];
  }

  accelerate ( delta, faster = true ) {
    const prevSpeed = this.state.speed;
    const accelerateBy = this.state.acceleration / delta;
    const breakBy = this.state.breaking / delta;
    let newSpeed;

    if ( faster ) {
      newSpeed = Math.min( this.state.maxSpeed, prevSpeed + accelerateBy );
    }
    else {
      newSpeed = Math.max( 0, prevSpeed - breakBy );
    }
    // set new speed
    this._state.speed = newSpeed;
  }

  decelerate ( delta ) {
    this.accelerate( delta, false );
  }

  turnLeft ( delta ) {
    const turnBy = this.state.turnSpeed / delta;
    const newDirection =  this.changeDirection( -turnBy );
    this._state.direction = newDirection;
  }

  turnRight ( delta ) {
    const turnBy = this.state.turnSpeed / delta;
    const newDirection =  this.changeDirection( turnBy );
    this._state.direction = newDirection;
  }

  turnToward ( delta, direction ) {
    
    const diff = direction - this.state.direction;
    const turnBy = Math.min( this.state.turnSpeed / delta, diff );

    const isLeftTurn = gameUtils.getIsDirectionToLeft( this.state.direction, direction );

    if ( isLeftTurn ) {
      this._state.direction =  this.changeDirection( -turnBy );
      return;
    }

    this._state.direction =  this.changeDirection( turnBy );
  }

  strafeLeft ( delta ) {
    const { x, y } = this.state;
    const newDirection =  this.changeDirection( -90 );
    // get new coords
    const heroPos = this.getPosition( delta, x, y, newDirection, this.strafeSpeed );
    // update the state
    this._state.x = heroPos.x;
    this._state.y = heroPos.y;
  }

  strafeRight ( delta ) {
    const { x, y } = this.state;
    const newDirection =  this.changeDirection( 90 );
    // get new coords
    const heroPos = this.getPosition( delta, x, y, newDirection, this.strafeSpeed );
    // update the state
    this._state.x = heroPos.x;
    this._state.y = heroPos.y;
  }

  shoot ( shotDirection ) {
    const { direction, speed, shotSpeed, shotPower } = this.state;
    const { x, y } = this.circle;

    if ( typeof shotDirection === 'undefined' ) {
      shotDirection = direction;
    }

    const shot = new Shot( this._canvas, {
      direction: shotDirection,
      speed: speed + shotSpeed,
      power: shotPower,
      health: 2,
      x: x,
      y: y
    });

    this._state.shots.push( shot );

    // TODO: need to filter out shots too far away
    if ( this.state._class === 'AiShip' ) {
      // console.log('Alien shot');
      HeadSfx.play( SOUNDS.LASER_ALIEN_1, this.audioVolume );
      
    }

    if ( this.state._class === 'Ship' ) {
      // console.log('Player shot');
      HeadSfx.play( SOUNDS.LASER_PLAYER, 1 );


    }
  }

  bomb () {
    const { direction, speed, shotSpeed, shotPower } = this.state;
    const { x, y } = this.circle;
    const shot = new Shot( this._canvas, {
      direction: direction,
      speed: speed + shotSpeed,
      power: 100,
      health: 2,
      size: 20,
      x: x,
      y: y,
      color: 'ff0000'
    });

    // TODO: need to filter out shots too far away
    if ( this.state._class === 'Ship' ) {
      HeadSfx.play( SOUNDS.LASER_LONG, 1 );
    }

    this._state.shots.push( shot );
  }

  update ( delta ) {

    this._state.shots = this.state.shots.filter( ( shotInstance ) => {
      const shot = shotInstance.state;
      if ( shot.health <= 0 ) {
        return false;
      }
      return true;
    });
    // update the targetDirection
    this._state.targetDirection = this.targetDirection;
    super.update( delta );
  }

  get target () {
    return this.state.target;
  }

  set target ( _target ) {
    this._state.target = _target;
  }

  get targetDistance () {
    return gameUtils.getDistance( this.state.circle, this.target.circle );
  }

  get targetDirection () {
    return gameUtils.getDirection( this.state, this.target );
  }

  get strafeSpeed () {
    return this.state.strafeSpeed + this.state.speed * 0.25;
  }
}

export default Ship;
