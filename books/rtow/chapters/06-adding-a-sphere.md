# Adding a Sphere
Let’s add a single object to our ray tracer. People often use spheres in ray tracers because
calculating whether a ray hits a sphere is relatively simple.


## Ray-Sphere Intersection
The equation for a sphere of radius \(r\) that is centered at the origin is an important mathematical
equation:

    \[ x^2 + y^2 + z^2 = r^2 \]

You can also think of this as saying that if a given point \((x,y,z)\) is on the surface of the
sphere, then \(x^2 + y^2 + z^2 = r^2\). If a given point \((x,y,z)\) is _inside_ the sphere, then
\(x^2 + y^2 + z^2 < r^2\), and if a given point \((x,y,z)\) is _outside_ the sphere, then
\(x^2 + y^2 + z^2 > r^2\).

If we want to allow the sphere center to be at an arbitrary point \((C_x, C_y, C_z)\), then the
equation becomes a lot less nice:

  \[ (C_x - x)^2 + (C_y - y)^2 + (C_z - z)^2 = r^2 \]

In graphics, you almost always want your formulas to be in terms of vectors so that all the
\(x\)/\(y\)/\(z\) stuff can be simply represented using a `vec3` class. You might note that the vector
from point \(\mathbf{P} = (x,y,z)\) to center \(\mathbf{C} = (C_x, C_y, C_z)\) is
\((\mathbf{C} - \mathbf{P})\).

If we use the definition of the dot product:

  \[ (\mathbf{C} - \mathbf{P}) \cdot (\mathbf{C} - \mathbf{P})
     = (C_x - x)^2 + (C_y - y)^2 + (C_z - z)^2
  \]

Then we can rewrite the equation of the sphere in vector form as:

  \[ (\mathbf{C} - \mathbf{P}) \cdot (\mathbf{C} - \mathbf{P}) = r^2 \]

We can read this as “any point \(\mathbf{P}\) that satisfies this equation is on the sphere”. We want
to know if our ray \(\mathbf{P}(t) = \mathbf{Q} + t\mathbf{d}\) ever hits the sphere anywhere. If it
does hit the sphere, there is some \(t\) for which \(\mathbf{P}(t)\) satisfies the sphere equation. So
we are looking for any \(t\) where this is true:

  \[ (\mathbf{C} - \mathbf{P}(t)) \cdot (\mathbf{C} - \mathbf{P}(t)) = r^2 \]

which can be found by replacing \(\mathbf{P}(t)\) with its expanded form:

  \[ (\mathbf{C} - (\mathbf{Q} + t \mathbf{d}))
      \cdot (\mathbf{C} - (\mathbf{Q} + t \mathbf{d})) = r^2 \]

We have three vectors on the left dotted by three vectors on the right. If we solved for the full
dot product we would get nine vectors. You can definitely go through and write everything out, but
we don't need to work that hard. If you remember, we want to solve for \(t\), so we'll separate the
terms based on whether there is a \(t\) or not:

  \[ (-t \mathbf{d} + (\mathbf{C} - \mathbf{Q})) \cdot (-t \mathbf{d} + (\mathbf{C} - \mathbf{Q}))
     = r^2
  \]

And now we follow the rules of vector algebra to distribute the dot product:

  \[ t^2 \mathbf{d} \cdot \mathbf{d}
     - 2t \mathbf{d} \cdot (\mathbf{C} - \mathbf{Q})
     + (\mathbf{C} - \mathbf{Q}) \cdot (\mathbf{C} - \mathbf{Q}) = r^2
  \]

Move the square of the radius over to the left hand side:

  \[ t^2 \mathbf{d} \cdot \mathbf{d}
     - 2t \mathbf{d} \cdot (\mathbf{C} - \mathbf{Q})
     + (\mathbf{C} - \mathbf{Q}) \cdot (\mathbf{C} - \mathbf{Q}) - r^2 = 0
  \]

It's hard to make out what exactly this equation is, but the vectors and \(r\) in that equation are
all constant and known. Furthermore, the only vectors that we have are reduced to scalars by dot
product. The only unknown is \(t\), and we have a \(t^2\), which means that this equation is quadratic.
You can solve for a quadratic equation \(ax^2 + bx + c = 0\) by using the quadratic formula:

  \[ \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} \]

So solving for \(t\) in the ray-sphere intersection equation gives us these values for \(a\), \(b\), and
\(c\):

  \[ a = \mathbf{d} \cdot \mathbf{d} \]
  \[ b = -2 \mathbf{d} \cdot (\mathbf{C} - \mathbf{Q}) \]
  \[ c = (\mathbf{C} - \mathbf{Q}) \cdot (\mathbf{C} - \mathbf{Q}) - r^2 \]

Using all of the above you can solve for \(t\), but there is a square root part that can be either
positive (meaning two real solutions), negative (meaning no real solutions), or zero (meaning one
real solution). In graphics, the algebra almost always relates very directly to the geometry. What
we have is:

  ![Figure [ray-sphere]: Ray-sphere intersection results](../images/fig-1.05-ray-sphere.jpg)


## Creating Our First Raytraced Image
If we take that math and hard-code it into our program, we can test our code by placing a small
sphere at -1 on the z-axis and then coloring red any pixel that intersects it.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    bool hit_sphere(const point3& center, double radius, const ray& r) {
        vec3 oc = center - r.origin();
        auto a = dot(r.direction(), r.direction());
        auto b = -2.0 * dot(r.direction(), oc);
        auto c = dot(oc, oc) - radius*radius;
        auto discriminant = b*b - 4*a*c;
        return (discriminant >= 0);
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    color ray_color(const ray& r) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        if (hit_sphere(point3(0,0,-1), 0.5, r))
            return color(1, 0, 0);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        vec3 unit_direction = unit_vector(r.direction());
        auto a = 0.5*(unit_direction.y() + 1.0);
        return (1.0-a)*color(1.0, 1.0, 1.0) + a*color(0.5, 0.7, 1.0);
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [main-red-sphere]: <kbd>[main.cc]</kbd> Rendering a red sphere]

<div class='together'>
What we get is this:

  ![Image 3: A simple red sphere](data:image/png;base64,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)

</div>

Now this lacks all sorts of things -- like shading, reflection rays, and more than one object -- but
we are closer to halfway done than we are to our start! One thing to be aware of is that we are
testing to see if a ray intersects with the sphere by solving the quadratic equation and seeing if a
solution exists, but solutions with negative values of \(t\) work just fine. If you change your sphere
center to \(z = +1\) you will get exactly the same picture because this solution doesn't distinguish
between objects _in front of the camera_ and objects _behind the camera_. This is not a feature!
We’ll fix those issues next.
