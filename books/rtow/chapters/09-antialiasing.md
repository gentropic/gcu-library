# Antialiasing
If you zoom into the rendered images so far, you might notice the harsh "stair step" nature of edges
in our rendered images. This stair-stepping is commonly referred to as "aliasing", or "jaggies".
When a real camera takes a picture, there are usually no jaggies along edges, because the edge
pixels are a blend of some foreground and some background. Consider that unlike our rendered images,
a true image of the world is continuous. Put another way, the world (and any true image of it) has
effectively infinite resolution. We can get the same effect by averaging a bunch of samples for each
pixel.

With a single ray through the center of each pixel, we are performing what is commonly called _point
sampling_. The problem with point sampling can be illustrated by rendering a small checkerboard far
away. If this checkerboard consists of an 8&times;8 grid of black and white tiles, but only four
rays hit it, then all four rays might intersect only white tiles, or only black, or some odd
combination. In the real world, when we perceive a checkerboard far away with our eyes, we perceive
it as a gray color, instead of sharp points of black and white. That's because our eyes are
naturally doing what we want our ray tracer to do: integrate the (continuous function of) light
falling on a particular (discrete) region of our rendered image.

Clearly we don't gain anything by just resampling the same ray through the pixel center multiple
times -- we'd just get the same result each time. Instead, we want to sample the light falling
_around_ the pixel, and then integrate those samples to approximate the true continuous result. So,
how do we integrate the light falling around the pixel?

We'll adopt the simplest model: sampling the square region centered at the pixel that extends
halfway to each of the four neighboring pixels. This is not the optimal approach, but it is the most
straight-forward. (See [_A Pixel is Not a Little Square_][square-pixels] for a deeper dive into this
topic.)

  ![Figure [pixel-samples]: Pixel samples](../images/fig-1.08-pixel-samples.jpg)


## Some Random Number Utilities
We're going to need a random number generator that returns real random numbers. This function should
return a canonical random number, which by convention falls in the range \(0 ≤ n < 1\). The “less
than” before the 1 is important, as we will sometimes take advantage of that.

A simple approach to this is to use the `std::rand()` function that can be found in `<cstdlib>`,
which returns a random integer in the range 0 and `RAND_MAX`. Hence we can get a real random number
as desired with the following code snippet, added to `rtweekend.h`:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include <cmath>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    #include <cstdlib>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include <iostream>
    #include <limits>
    #include <memory>
    ...

    // Utility Functions

    inline double degrees_to_radians(double degrees) {
        return degrees * pi / 180.0;
    }


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    inline double random_double() {
        // Returns a random real in [0,1).
        return std::rand() / (RAND_MAX + 1.0);
    }

    inline double random_double(double min, double max) {
        // Returns a random real in [min,max).
        return min + (max-min)*random_double();
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [random-double]: <kbd>[rtweekend.h]</kbd> random_double() functions]

C++ did not traditionally have a standard random number generator, but newer versions of C++ have
addressed this issue with the `<random>` header (if imperfectly according to some experts). If you
want to use this, you can obtain a random number with the conditions we need as follows:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    ...


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    #include <random>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

    ...


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    inline double random_double() {
        static std::uniform_real_distribution<double> distribution(0.0, 1.0);
        static std::mt19937 generator;
        return distribution(generator);
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

    inline double random_double(double min, double max) {
        // Returns a random real in [min,max).
        return min + (max-min)*random_double();
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++


    ...

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [random-double-alt]: <kbd>[rtweekend.h]</kbd> random_double(), alternate implementation]


## Generating Pixels with Multiple Samples
For a single pixel composed of multiple samples, we'll select samples from the area surrounding the
pixel and average the resulting light (color) values together.

First we'll update the `write_color()` function to account for the number of samples we use: we need
to find the average across all of the samples that we take. To do this, we'll add the full color
from each iteration, and then finish with a single division (by the number of samples) at the end,
before writing out the color. To ensure that the color components of the final result remain within
the proper \([0,1]\) bounds, we'll add and use a small helper function: `interval::clamp(x)`.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    class interval {
      public:
        ...

        bool surrounds(double x) const {
            return min < x && x < max;
        }


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        double clamp(double x) const {
            if (x < min) return min;
            if (x > max) return max;
            return x;
        }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
        ...
    };
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [clamp]: <kbd>[interval.h]</kbd> The interval::clamp() utility function]

Here's the updated `write_color()` function that incorporates the interval clamping function:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    #include "interval.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include "vec3.h"

    using color = vec3;

    void write_color(std::ostream& out, const color& pixel_color) {
        auto r = pixel_color.x();
        auto g = pixel_color.y();
        auto b = pixel_color.z();

        // Translate the [0,1] component values to the byte range [0,255].
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        static const interval intensity(0.000, 0.999);
        int rbyte = int(256 * intensity.clamp(r));
        int gbyte = int(256 * intensity.clamp(g));
        int bbyte = int(256 * intensity.clamp(b));
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        // Write out the pixel color components.
        out << rbyte << ' ' << gbyte << ' ' << bbyte << '\n';
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [write-color-clamped]: <kbd>[color.h]</kbd> The multi-sample write_color() function]

Now let's update the camera class to define and use a new `camera::get_ray(i,j)` function, which
will generate different samples for each pixel. This function will use a new helper function
`sample_square()` that generates a random sample point within the unit square centered at the
origin. We then transform the random sample from this ideal square back to the particular pixel
we're currently sampling.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    class camera {
      public:
        double aspect_ratio      = 1.0;  // Ratio of image width over height
        int    image_width       = 100;  // Rendered image width in pixel count
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        int    samples_per_pixel = 10;   // Count of random samples for each pixel
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        void render(const hittable& world) {
            initialize();

            std::cout << "P3\n" << image_width << ' ' << image_height << "\n255\n";

            for (int j = 0; j < image_height; j++) {
                std::clog << "\rScanlines remaining: " << (image_height - j) << ' ' << std::flush;
                for (int i = 0; i < image_width; i++) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
                    color pixel_color(0,0,0);
                    for (int sample = 0; sample < samples_per_pixel; sample++) {
                        ray r = get_ray(i, j);
                        pixel_color += ray_color(r, world);
                    }
                    write_color(std::cout, pixel_samples_scale * pixel_color);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
                }
            }

            std::clog << "\rDone.                 \n";
        }
        ...
      private:
        int    image_height;         // Rendered image height
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        double pixel_samples_scale;  // Color scale factor for a sum of pixel samples
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
        point3 center;               // Camera center
        point3 pixel00_loc;          // Location of pixel 0, 0
        vec3   pixel_delta_u;        // Offset to pixel to the right
        vec3   pixel_delta_v;        // Offset to pixel below

        void initialize() {
            image_height = int(image_width / aspect_ratio);
            image_height = (image_height < 1) ? 1 : image_height;


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
            pixel_samples_scale = 1.0 / samples_per_pixel;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

            center = point3(0, 0, 0);
            ...
        }


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        ray get_ray(int i, int j) const {
            // Construct a camera ray originating from the origin and directed at randomly sampled
            // point around the pixel location i, j.

            auto offset = sample_square();
            auto pixel_sample = pixel00_loc
                              + ((i + offset.x()) * pixel_delta_u)
                              + ((j + offset.y()) * pixel_delta_v);

            auto ray_origin = center;
            auto ray_direction = pixel_sample - ray_origin;

            return ray(ray_origin, ray_direction);
        }

        vec3 sample_square() const {
            // Returns the vector to a random point in the [-.5,-.5]-[+.5,+.5] unit square.
            return vec3(random_double() - 0.5, random_double() - 0.5, 0);
        }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        color ray_color(const ray& r, const hittable& world) const {
            ...
        }
    };

    #endif
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [camera-spp]: <kbd>[camera.h]</kbd> Camera with samples-per-pixel parameter]

</div>

(In addition to the new `sample_square()` function above, you'll also find the function
`sample_disk()` in the Github source code. This is included in case you'd like to experiment with
non-square pixels, but we won't be using it in this book. `sample_disk()` depends on the function
`random_in_unit_disk()` which is defined later on.)

<div class='together'>
Main is updated to set the new camera parameter.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    int main() {
        ...

        camera cam;

        cam.aspect_ratio      = 16.0 / 9.0;
        cam.image_width       = 400;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        cam.samples_per_pixel = 100;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        cam.render(world);
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [main-spp]: <kbd>[main.cc]</kbd> Setting the new samples-per-pixel parameter]

</div>

<div class='together'>
Zooming into the image that is produced, we can see the difference in edge pixels.

  ![Image 6: Before and after antialiasing](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyBpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkNGOTRFRTk0OUM3NjExRUFBNkM2RThBMUVFRTU3ODQ2IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkNGOTRFRTk1OUM3NjExRUFBNkM2RThBMUVFRTU3ODQ2Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6Q0Y5NEVFOTI5Qzc2MTFFQUE2QzZFOEExRUVFNTc4NDYiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6Q0Y5NEVFOTM5Qzc2MTFFQUE2QzZFOEExRUVFNTc4NDYiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6kPIcvAAAGTUlEQVR42rxYS4scVRQ+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)

</div>
