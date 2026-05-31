# Rays, a Simple Camera, and Background
## The ray Class
The one thing that all ray tracers have is a ray class and a computation of what color is seen along
a ray. Let’s think of a ray as a function \(\mathbf{P}(t) = \mathbf{A} + t \mathbf{b}\). Here
\(\mathbf{P}\) is a 3D position along a line in 3D. \(\mathbf{A}\) is the ray origin and \(\mathbf{b}\) is
the ray direction. The ray parameter \(t\) is a real number (`double` in the code). Plug in a
different \(t\) and \(\mathbf{P}(t)\) moves the point along the ray. Add in negative \(t\) values and you
can go anywhere on the 3D line. For positive \(t\), you get only the parts in front of \(\mathbf{A}\),
and this is what is often called a half-line or a ray.

  ![Figure [lerp]: Linear interpolation](../images/fig-1.02-lerp.jpg)

<div class='together'>
We can represent the idea of a ray as a class, and represent the function \(\mathbf{P}(t)\) as a
function that we'll call `ray::at(t)`:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #ifndef RAY_H
    #define RAY_H

    #include "vec3.h"

    class ray {
      public:
        ray() {}

        ray(const point3& origin, const vec3& direction) : orig(origin), dir(direction) {}

        const point3& origin() const  { return orig; }
        const vec3& direction() const { return dir; }

        point3 at(double t) const {
            return orig + t*dir;
        }

      private:
        point3 orig;
        vec3 dir;
    };

    #endif
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [ray-initial]: <kbd>[ray.h]</kbd> The ray class]

</div>

(For those unfamiliar with C++, the functions `ray::origin()` and `ray::direction()` both return an
immutable reference to their members. Callers can either just use the reference directly, or make a
mutable copy depending on their needs.)


## Sending Rays Into the Scene
Now we are ready to turn the corner and make a ray tracer. At its core, a ray tracer sends rays
through pixels and computes the color seen in the direction of those rays. The involved steps are

    1. Calculate the ray from the “eye” through the pixel,
    2. Determine which objects the ray intersects, and
    3. Compute a color for the closest intersection point.

When first developing a ray tracer, I always do a simple camera for getting the code up and running.

I’ve often gotten into trouble using square images for debugging because I transpose \(x\) and \(y\) too
often, so we’ll use a non-square image. A square image has a 1&ratio;1 aspect ratio, because its
width is the same as its height. Since we want a non-square image, we'll choose 16&ratio;9 because
it's so common. A 16&ratio;9 aspect ratio means that the ratio of image width to image height is
16&ratio;9. Put another way, given an image with a 16&ratio;9 aspect ratio,

  \[\text{width} / \text{height} = 16 / 9 = 1.7778\]

For a practical example, an image 800 pixels wide by 400 pixels high has a 2&ratio;1 aspect ratio.

The image's aspect ratio can be determined from the ratio of its width to its height. However, since
we have a given aspect ratio in mind, it's easier to set the image's width and the aspect ratio, and
then using this to calculate for its height. This way, we can scale up or down the image by changing
the image width, and it won't throw off our desired aspect ratio. We do have to make sure that when
we solve for the image height the resulting height is at least 1.

In addition to setting up the pixel dimensions for the rendered image, we also need to set up a
virtual _viewport_ through which to pass our scene rays. The viewport is a virtual rectangle in the
3D world that contains the grid of image pixel locations. If pixels are spaced the same distance
horizontally as they are vertically, the viewport that bounds them will have the same aspect ratio
as the rendered image. The distance between two adjacent pixels is called the pixel spacing, and
square pixels is the standard.

To start things off, we'll choose an arbitrary viewport height of 2.0, and scale the viewport width
to give us the desired aspect ratio. Here's a snippet of what this code will look like:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    auto aspect_ratio = 16.0 / 9.0;
    int image_width = 400;

    // Calculate the image height, and ensure that it's at least 1.
    int image_height = int(image_width / aspect_ratio);
    image_height = (image_height < 1) ? 1 : image_height;

    // Viewport widths less than one are ok since they are real valued.
    auto viewport_height = 2.0;
    auto viewport_width = viewport_height * (double(image_width)/image_height);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [image-setup]: Rendered image setup]

If you're wondering why we don't just use `aspect_ratio` when computing `viewport_width`, it's
because the value set to `aspect_ratio` is the ideal ratio, it may not be the _actual_ ratio between
`image_width` and `image_height`. If `image_height` was allowed to be real valued--rather than just
an integer--then it would be fine to use `aspect_ratio`. But the _actual_ ratio between
`image_width` and `image_height` can vary based on two parts of the code. First, `image_height` is
rounded down to the nearest integer, which can increase the ratio. Second, we don't allow
`image_height` to be less than one, which can also change the actual aspect ratio.

Note that `aspect_ratio` is an ideal ratio, which we approximate as best as possible with the
integer-based ratio of image width over image height. In order for our viewport proportions to
exactly match our image proportions, we use the calculated image aspect ratio to determine our final
viewport width.

Next we will define the camera center: a point in 3D space from which all scene rays will originate
(this is also commonly referred to as the _eye point_). The vector from the camera center to the
viewport center will be orthogonal to the viewport. We'll initially set the distance between the
viewport and the camera center point to be one unit. This distance is often referred to as the
_focal length_.

For simplicity we'll start with the camera center at \((0,0,0)\). We'll also have the y-axis go up,
the x-axis to the right, and the negative z-axis pointing in the viewing direction. (This is
commonly referred to as _right-handed coordinates_.)

  ![Figure [camera-geom]: Camera geometry](../images/fig-1.03-cam-geom.jpg)

Now the inevitable tricky part. While our 3D space has the conventions above, this conflicts with
our image coordinates, where we want to have the zeroth pixel in the top-left and work our way down
to the last pixel at the bottom right. This means that our image coordinate Y-axis is inverted: Y
increases going down the image.

As we scan our image, we will start at the upper left pixel (pixel \(0,0\)), scan left-to-right across
each row, and then scan row-by-row, top-to-bottom. To help navigate the pixel grid, we'll use a
vector from the left edge to the right edge (\(\mathbf{V_u}\)), and a vector from the upper edge to
the lower edge (\(\mathbf{V_v}\)).

Our pixel grid will be inset from the viewport edges by half the pixel-to-pixel distance. This way,
our viewport area is evenly divided into width &times; height identical regions. Here's what our
viewport and pixel grid look like:

  ![Figure [pixel-grid]: Viewport and pixel grid](../images/fig-1.04-pixel-grid.jpg)

In this figure, we have the viewport, the pixel grid for a 7&times;5 resolution image, the viewport
upper left corner \(\mathbf{Q}\), the pixel \(\mathbf{P_{0,0}}\) location, the viewport vector
\(\mathbf{V_u}\) (`viewport_u`), the viewport vector \(\mathbf{V_v}\) (`viewport_v`), and the pixel
delta vectors \(\mathbf{\Delta u}\) and \(\mathbf{\Delta v}\).

<div class='together'>
Drawing from all of this, here's the code that implements the camera. We'll stub in a function
`ray_color(const ray& r)` that returns the color for a given scene ray -- which we'll set to always
return black for now.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include "color.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    #include "ray.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include "vec3.h"

    #include <iostream>


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    color ray_color(const ray& r) {
        return color(0,0,0);
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

    int main() {

        // Image


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        auto aspect_ratio = 16.0 / 9.0;
        int image_width = 400;

        // Calculate the image height, and ensure that it's at least 1.
        int image_height = int(image_width / aspect_ratio);
        image_height = (image_height < 1) ? 1 : image_height;

        // Camera

        auto focal_length = 1.0;
        auto viewport_height = 2.0;
        auto viewport_width = viewport_height * (double(image_width)/image_height);
        auto camera_center = point3(0, 0, 0);

        // Calculate the vectors across the horizontal and down the vertical viewport edges.
        auto viewport_u = vec3(viewport_width, 0, 0);
        auto viewport_v = vec3(0, -viewport_height, 0);

        // Calculate the horizontal and vertical delta vectors from pixel to pixel.
        auto pixel_delta_u = viewport_u / image_width;
        auto pixel_delta_v = viewport_v / image_height;

        // Calculate the location of the upper left pixel.
        auto viewport_upper_left = camera_center
                                 - vec3(0, 0, focal_length) - viewport_u/2 - viewport_v/2;
        auto pixel00_loc = viewport_upper_left + 0.5 * (pixel_delta_u + pixel_delta_v);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        // Render

        std::cout << "P3\n" << image_width << " " << image_height << "\n255\n";

        for (int j = 0; j < image_height; j++) {
            std::clog << "\rScanlines remaining: " << (image_height - j) << ' ' << std::flush;
            for (int i = 0; i < image_width; i++) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
                auto pixel_center = pixel00_loc + (i * pixel_delta_u) + (j * pixel_delta_v);
                auto ray_direction = pixel_center - camera_center;
                ray r(camera_center, ray_direction);

                color pixel_color = ray_color(r);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
                write_color(std::cout, pixel_color);
            }
        }

        std::clog << "\rDone.                 \n";
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [creating-rays]: <kbd>[main.cc]</kbd> Creating scene rays]

</div>

Notice that in the code above, I didn't make `ray_direction` a unit vector, because I think not
doing that makes for simpler and slightly faster code.

Now we'll fill in the `ray_color(ray)` function to implement a simple gradient. This function will
linearly blend white and blue depending on the height of the \(y\) coordinate _after_ scaling the ray
direction to unit length (so \(-1.0 < y < 1.0\)). Because we're looking at the \(y\) height after
normalizing the vector, you'll notice a horizontal gradient to the color in addition to the vertical
gradient.

I'll use a standard graphics trick to linearly scale \(0.0 ≤ a ≤ 1.0\). When \(a = 1.0\), I want blue.
When \(a = 0.0\), I want white. In between, I want a blend. This forms a “linear blend”, or “linear
interpolation”. This is commonly referred to as a _lerp_ between two values. A lerp is always of the
form

  \[ \mathit{blendedValue} = (1-a)\cdot\mathit{startValue} + a\cdot\mathit{endValue}, \]

with \(a\) going from zero to one.

<div class='together'>
Putting all this together, here's what we get:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include "color.h"
    #include "ray.h"
    #include "vec3.h"

    #include <iostream>


    color ray_color(const ray& r) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        vec3 unit_direction = unit_vector(r.direction());
        auto a = 0.5*(unit_direction.y() + 1.0);
        return (1.0-a)*color(1.0, 1.0, 1.0) + a*color(0.5, 0.7, 1.0);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    }

    ...
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [main-blue-white-blend]: <kbd>[main.cc]</kbd> Rendering a blue-to-white gradient]

</div>

<div class='together'>
In our case this produces:

  ![Image 2: A blue-to-white gradient depending on ray Y coordinate](data:image/png;base64,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)

</div>
