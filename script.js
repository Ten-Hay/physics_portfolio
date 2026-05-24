const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const BALLZ = [];
const ATTACHMENTS = [];

class Ball {
    constructor(x, y, r){
        this.x = x;
        this.y = y;
        this.target_x = x;
        this.target_y = y;
        this.r = r;
        this.velo_x = 10;
        this.moving = false;
        this.curve = null;
        
        this.isDynamic = false; 
        
        BALLZ.push(this);
    }


    get anchorX() { return this.x; }
    get anchorY() { return this.y; }

    drawBall(){
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, 2*Math.PI);
        ctx.strokeStyle = "black";
        ctx.stroke();
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.closePath();
    }

    calculateY() {
        return Math.pow(this.x - this.curve.h, 2) * this.curve.a + this.curve.k;
    }
}

class Curve {
    constructor(a, h, k) {
        this.a = a;
        this.h = h;
        this.k = k;
    }
}

class AttachedRect {
    // TWEAK: anchorBall is now a generic 'parent'
    constructor(parent, length, height) {
        this.parent = parent;
        this.length = length;
        this.height = height;
        
        // NEW: Tell the engine this object CAN be pulled
        this.isDynamic = true;
        
        this.tailX = parent.anchorX;
        this.tailY = parent.anchorY + length;
        this.oldX = this.tailX;
        this.oldY = this.tailY;
        
        ATTACHMENTS.push(this);
    }

    // NEW: Expose our tail as the anchor for the NEXT joint in the chain
    get anchorX() { return this.tailX; }
    get anchorY() { return this.tailY; }

    applyVelocityAndGravity() {
        let vx = this.tailX - this.oldX;
        let vy = this.tailY - this.oldY;
        
        // Air friction
        vx *= 0.98;
        vy *= 0.98;

        this.oldX = this.tailX;
        this.oldY = this.tailY;
        
        this.tailX += vx;
        this.tailY += vy + 0.5; // Gravity
    }

    solveConstraint() {
        const dx = this.tailX - this.parent.anchorX;
        const dy = this.tailY - this.parent.anchorY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const difference = this.length - distance;
            const percent = difference / distance;
            
            if (this.parent.isDynamic) {
                // If attached to another rectangle, both move 50% towards/away from each other
                const offsetX = dx * percent * 0.5;
                const offsetY = dy * percent * 0.5;
                
                this.tailX += offsetX;
                this.tailY += offsetY;
                this.parent.tailX -= offsetX; // Pulls the parent's tail
                this.parent.tailY -= offsetY;
            } else {
                // If attached to the ball, the ball doesn't move, so we move 100%
                this.tailX += dx * percent;
                this.tailY += dy * percent;
            }
        }
    }

    draw() {
        const dx = this.tailX - this.parent.anchorX;
        const dy = this.tailY - this.parent.anchorY;
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(this.parent.anchorX, this.parent.anchorY);
        ctx.rotate(angle);
        
        ctx.fillStyle = "blue";
        // Draw centered on the joint
        ctx.fillRect(0, -this.height / 2, this.length, this.height);
        
        // Optional: Draw a small pin to show the joint connection
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, 2*Math.PI);
        ctx.fill();
        
        ctx.restore();
    }
}

canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    Ball1.target_x = e.clientX - rect.left;
    Ball1.target_y = e.clientY - rect.top;

    let speed = Math.abs(Ball1.velo_x);
    Ball1.velo_x = (Ball1.target_x > Ball1.x) ? speed : -speed;

    Ball1.curve = calculateCurve(Ball1.x, Ball1.y, Ball1.target_x, Ball1.target_y);
    Ball1.moving = true;
});

function calculateCurve(start_x, start_y, final_x, final_y) {
    const p = 50;
    let k = Math.min(start_y, final_y) - p; 
    
    let r = Math.sqrt((k - start_y) / (k - final_y));
    let h = (r * final_x + start_x) / (1 + r);
    let a = (start_y - k) / (Math.pow(start_x - h, 2));
    
    return new Curve(a, h, k);
}

function mainLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // 1. Move Kinematic Bodies (The Ball)
    BALLZ.forEach((b) => {
        if (b.moving) {
            const passedMovingRight = b.velo_x > 0 && b.x >= b.target_x;
            const passedMovingLeft = b.velo_x < 0 && b.x <= b.target_x;
            
            if (passedMovingRight || passedMovingLeft) {
                b.x = b.target_x;
                b.y = b.target_y;
                b.moving = false;
            } else {
                b.x += b.velo_x;
                b.y = b.calculateY();
            }
        }
    });

    // 2. Apply velocities and gravity to the chain
    ATTACHMENTS.forEach((att) => att.applyVelocityAndGravity());

    // 3. Solve Constraints (Iterate multiple times for stiffness)
    for (let i = 0; i < 5; i++) {
        ATTACHMENTS.forEach((att) => att.solveConstraint());
    }

    // 4. Draw everything
    ATTACHMENTS.forEach((att) => att.draw());
    BALLZ.forEach((b) => b.drawBall());

    requestAnimationFrame(mainLoop);
}

// Initialization
let Ball1 = new Ball(100, 400, 20);

let Tail1 = new AttachedRect(Ball1, 60, 15);
let Tail2 = new AttachedRect(Tail1, 60, 15);

requestAnimationFrame(mainLoop);