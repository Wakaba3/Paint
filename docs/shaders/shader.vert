attribute vec4 position;
attribute vec4 color;

varying vec4 outColor;

void main(void) {
    gl_Position = position;
    outColor = color;
}