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
    constructor(parent, length, height) {
        this.parent = parent;
        this.length = length;
        this.height = height;
        
        this.isDynamic = true;
        
        this.tailX = parent.anchorX;
        this.tailY = parent.anchorY + length;
        this.oldX = this.tailX;
        this.oldY = this.tailY;
        
        ATTACHMENTS.push(this);
    }

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
                const offsetX = dx * percent * 0.5;
                const offsetY = dy * percent * 0.5;
                
                this.tailX += offsetX;
                this.tailY += offsetY;
                this.parent.tailX -= offsetX; 
                this.parent.tailY -= offsetY;
            } else {
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
        ctx.fillRect(0, -this.height / 2, this.length, this.height);
        
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

    // --- NEW LOGIC: Prevent divide-by-zero if user clicks exactly vertically ---
    if (Ball1.target_x === Ball1.x) {
        Ball1.target_x += 1; 
    }

    // --- NEW LOGIC: Calibrate velo_x based on total straight-line distance ---
    const dx = Ball1.target_x - Ball1.x;
    const dy = Ball1.target_y - Ball1.y;
    const totalDistance = Math.hypot(dx, dy);
    
    const desiredOverallSpeed = 10; // Change this number to make the ball faster or slower overall!
    const framesToArrival = totalDistance / desiredOverallSpeed;

    Ball1.velo_x = dx / framesToArrival;

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
            // --- NEW LOGIC: Stop condition based on remaining distance ---
            const distanceToTargetX = Math.abs(b.target_x - b.x);
            
            if (distanceToTargetX <= Math.abs(b.velo_x)) {
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